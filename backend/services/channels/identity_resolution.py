import json
from datetime import datetime, timezone
from typing import Any


async def resolve_identity(identifiers: dict[str, str], db: Any) -> dict[str, Any]:
    """Attempt to match a customer across platforms using provided identifiers.

    identifiers may contain any combination of:
        - email: email address
        - instagram: Instagram handle
        - linkedin: LinkedIn profile URL or handle
        - reddit: Reddit username
        - twitter: Twitter/X handle
        - phone: phone number
        - name: full name (weakest signal, used as tiebreaker)

    Returns the best-matching unified profile or a list of candidates.
    """
    try:
        candidates: list[dict] = []

        # Priority 1 – exact email match
        if identifiers.get("email"):
            response = (
                db.table("unified_profiles")
                .select("*")
                .eq("email", identifiers["email"])
                .limit(5)
                .execute()
            )
            rows = response.data if hasattr(response, "data") else []
            candidates.extend(rows)

        # Priority 2 – social handle matches (search JSONB social_handles column)
        handle_fields = ["instagram", "linkedin", "reddit", "twitter"]
        for field in handle_fields:
            handle = identifiers.get(field)
            if not handle:
                continue
            response = (
                db.table("unified_profiles")
                .select("*")
                .ilike("social_handles", f"%{handle}%")
                .limit(5)
                .execute()
            )
            rows = response.data if hasattr(response, "data") else []
            candidates.extend(rows)

        # Priority 3 – phone match
        if identifiers.get("phone"):
            response = (
                db.table("unified_profiles")
                .select("*")
                .eq("phone", identifiers["phone"])
                .limit(5)
                .execute()
            )
            rows = response.data if hasattr(response, "data") else []
            candidates.extend(rows)

        # De-duplicate by profile id
        seen_ids: set[str] = set()
        unique: list[dict] = []
        for c in candidates:
            pid = str(c.get("id", ""))
            if pid and pid not in seen_ids:
                seen_ids.add(pid)
                unique.append(c)

        if len(unique) == 1:
            return {"match": "exact", "profile": unique[0]}
        elif len(unique) > 1:
            return {"match": "multiple", "candidates": unique, "count": len(unique)}
        else:
            return {"match": "none", "identifiers": identifiers}
    except Exception as exc:
        return {"error": f"Failed to resolve identity: {exc}"}


async def create_unified_profile(identity_data: dict[str, Any], db: Any) -> dict[str, Any]:
    """Create a new unified customer profile.

    identity_data expected keys:
        - email (required)
        - name (optional)
        - phone (optional)
        - social_handles: dict mapping platform -> handle (optional)
        - source_channel: the channel that originated this profile (optional)
        - metadata: any extra data (optional)
    """
    try:
        email_addr = identity_data.get("email")
        if not email_addr:
            return {"error": "Email is required to create a unified profile"}

        # Check for existing profile with same email
        existing = (
            db.table("unified_profiles")
            .select("id")
            .eq("email", email_addr)
            .limit(1)
            .execute()
        )
        existing_rows = existing.data if hasattr(existing, "data") else []
        if existing_rows:
            return {
                "error": "Profile already exists for this email",
                "existing_profile_id": existing_rows[0]["id"],
            }

        now = datetime.now(timezone.utc).isoformat()
        social_handles = identity_data.get("social_handles", {})

        record = {
            "email": email_addr,
            "name": identity_data.get("name", ""),
            "phone": identity_data.get("phone", ""),
            "social_handles": json.dumps(social_handles) if isinstance(social_handles, dict) else social_handles,
            "source_channel": identity_data.get("source_channel", ""),
            "metadata": json.dumps(identity_data.get("metadata", {})),
            "created_at": now,
            "updated_at": now,
        }

        response = db.table("unified_profiles").insert(record).execute()
        inserted = response.data if hasattr(response, "data") else []

        if inserted:
            return {"status": "created", "profile": inserted[0]}
        else:
            return {"error": "Insert returned no data"}
    except Exception as exc:
        return {"error": f"Failed to create unified profile: {exc}"}


async def link_accounts(primary_id: str, secondary_ids: list[str], db: Any) -> dict[str, Any]:
    """Link secondary customer profiles to a primary profile.

    This merges social handles, conversation history references, and metadata
    from each secondary profile into the primary, then marks secondaries as
    linked (not deleted, to preserve audit trail).

    Args:
        primary_id: The ID of the primary unified profile.
        secondary_ids: List of profile IDs to merge into the primary.
        db: A Supabase client instance.
    """
    try:
        # Fetch primary profile
        primary_resp = (
            db.table("unified_profiles")
            .select("*")
            .eq("id", primary_id)
            .limit(1)
            .execute()
        )
        primary_rows = primary_resp.data if hasattr(primary_resp, "data") else []
        if not primary_rows:
            return {"error": f"Primary profile {primary_id} not found"}

        primary = primary_rows[0]
        primary_handles = primary.get("social_handles", {})
        if isinstance(primary_handles, str):
            primary_handles = json.loads(primary_handles) if primary_handles else {}

        merged_count = 0
        errors: list[str] = []

        for sec_id in secondary_ids:
            try:
                sec_resp = (
                    db.table("unified_profiles")
                    .select("*")
                    .eq("id", sec_id)
                    .limit(1)
                    .execute()
                )
                sec_rows = sec_resp.data if hasattr(sec_resp, "data") else []
                if not sec_rows:
                    errors.append(f"Secondary profile {sec_id} not found")
                    continue

                secondary = sec_rows[0]
                sec_handles = secondary.get("social_handles", {})
                if isinstance(sec_handles, str):
                    sec_handles = json.loads(sec_handles) if sec_handles else {}

                # Merge handles (primary wins on conflicts)
                for platform, handle in sec_handles.items():
                    if platform not in primary_handles:
                        primary_handles[platform] = handle

                # Mark secondary as linked
                db.table("unified_profiles").update({
                    "linked_to": primary_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", sec_id).execute()

                # Re-assign conversations from secondary to primary
                db.table("conversations").update({
                    "customer_id": primary_id,
                }).eq("customer_id", sec_id).execute()

                merged_count += 1
            except Exception as inner_exc:
                errors.append(f"Error linking {sec_id}: {inner_exc}")

        # Update primary with merged handles
        db.table("unified_profiles").update({
            "social_handles": json.dumps(primary_handles),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", primary_id).execute()

        return {
            "primary_id": primary_id,
            "merged_count": merged_count,
            "social_handles": primary_handles,
            "errors": errors if errors else None,
        }
    except Exception as exc:
        return {"error": f"Failed to link accounts: {exc}"}
