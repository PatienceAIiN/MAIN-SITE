import json
from datetime import datetime, timezone
from typing import Any


async def unify_thread(
    customer_id: str, channel: str, messages: list[dict[str, Any]]
) -> dict[str, Any]:
    """Normalise messages from any channel into a unified thread format.

    Each message in the input list should contain at minimum:
        - text: the message body
        - timestamp: ISO-8601 string or Unix epoch
        - direction: "inbound" | "outbound"

    Returns a unified thread dict ready for storage or display.
    """
    try:
        unified: list[dict[str, Any]] = []
        for msg in messages:
            ts = msg.get("timestamp", "")
            # Normalise timestamp to ISO-8601 if it looks like an epoch
            if isinstance(ts, (int, float)):
                ts = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()

            unified.append({
                "customer_id": customer_id,
                "channel": channel,
                "text": msg.get("text", ""),
                "direction": msg.get("direction", "inbound"),
                "timestamp": ts,
                "metadata": {
                    "original_id": msg.get("id", msg.get("message_id", "")),
                    "author": msg.get("author", msg.get("from", "")),
                    "attachments": msg.get("attachments", []),
                },
            })

        # Sort chronologically
        unified.sort(key=lambda m: m["timestamp"])

        return {
            "customer_id": customer_id,
            "channel": channel,
            "thread": unified,
            "message_count": len(unified),
            "first_message_at": unified[0]["timestamp"] if unified else None,
            "last_message_at": unified[-1]["timestamp"] if unified else None,
        }
    except Exception as exc:
        return {"error": f"Failed to unify thread: {exc}"}


async def get_customer_history(customer_id: str, db: Any) -> dict[str, Any]:
    """Retrieve the full conversation history for a customer across all channels.

    Args:
        customer_id: The unified customer ID.
        db: A Supabase client instance.
    """
    try:
        response = (
            db.table("conversations")
            .select("*")
            .eq("customer_id", customer_id)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        conversations = response.data if hasattr(response, "data") else []

        # Group by channel
        by_channel: dict[str, list] = {}
        for conv in conversations:
            ch = conv.get("channel", "unknown")
            by_channel.setdefault(ch, []).append(conv)

        return {
            "customer_id": customer_id,
            "total_messages": len(conversations),
            "channels": list(by_channel.keys()),
            "history_by_channel": by_channel,
        }
    except Exception as exc:
        return {"error": f"Failed to get customer history: {exc}"}


async def merge_identities(
    email_addr: str, social_handles: dict[str, str], db: Any
) -> dict[str, Any]:
    """Link social handles to a customer record identified by email.

    social_handles example: {"instagram": "@user", "linkedin": "linkedin.com/in/user"}

    If a unified profile exists for the email, the handles are merged in.
    If not, a new unified profile is created.
    """
    try:
        # Look up existing profile by email
        response = (
            db.table("unified_profiles")
            .select("*")
            .eq("email", email_addr)
            .limit(1)
            .execute()
        )
        existing = response.data if hasattr(response, "data") else []

        if existing:
            profile = existing[0]
            current_handles = profile.get("social_handles", {}) or {}
            merged_handles = {**current_handles, **social_handles}

            update_resp = (
                db.table("unified_profiles")
                .update({
                    "social_handles": json.dumps(merged_handles),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("id", profile["id"])
                .execute()
            )
            updated = update_resp.data if hasattr(update_resp, "data") else []
            return {
                "action": "merged",
                "profile_id": profile["id"],
                "social_handles": merged_handles,
                "profile": updated[0] if updated else profile,
            }
        else:
            insert_resp = (
                db.table("unified_profiles")
                .insert({
                    "email": email_addr,
                    "social_handles": json.dumps(social_handles),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                .execute()
            )
            inserted = insert_resp.data if hasattr(insert_resp, "data") else []
            return {
                "action": "created",
                "profile_id": inserted[0]["id"] if inserted else None,
                "social_handles": social_handles,
                "profile": inserted[0] if inserted else None,
            }
    except Exception as exc:
        return {"error": f"Failed to merge identities: {exc}"}
