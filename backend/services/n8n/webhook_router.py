"""
Webhook Router - Handles incoming n8n webhook events and routes them to handlers.
"""

import uuid
import time
import json
import logging
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)

# Mapping of webhook event types to their descriptions and default handling.
WEBHOOK_TYPES: dict[str, dict[str, str]] = {
    "email.received": {
        "description": "New email received via n8n email trigger",
        "category": "communication",
    },
    "email.bounced": {
        "description": "Email delivery bounce notification",
        "category": "communication",
    },
    "form.submitted": {
        "description": "Contact or lead form submission",
        "category": "lead",
    },
    "payment.completed": {
        "description": "Payment successfully processed",
        "category": "transaction",
    },
    "payment.failed": {
        "description": "Payment processing failed",
        "category": "transaction",
    },
    "social.mention": {
        "description": "Brand mentioned on social media",
        "category": "social",
    },
    "social.dm": {
        "description": "Direct message received on social platform",
        "category": "social",
    },
    "review.posted": {
        "description": "New customer review posted",
        "category": "feedback",
    },
    "lead.created": {
        "description": "New lead captured from any source",
        "category": "lead",
    },
    "content.published": {
        "description": "Content published on external platform",
        "category": "content",
    },
    "analytics.alert": {
        "description": "Analytics threshold alert triggered",
        "category": "analytics",
    },
    "schedule.trigger": {
        "description": "Scheduled automation trigger fired",
        "category": "automation",
    },
}

# Runtime handler registry: webhook_type -> async handler function
_handlers: dict[str, Callable[..., Awaitable[dict]]] = {}


def register_handler(webhook_type: str, handler: Callable[..., Awaitable[dict]]) -> None:
    """Register an async handler for a specific webhook type."""
    _handlers[webhook_type] = handler
    logger.info("Registered webhook handler for: %s", webhook_type)


async def process_webhook(webhook_type: str, payload: dict, db: Any) -> dict:
    """
    Route an incoming webhook event to the appropriate handler.

    Args:
        webhook_type: Event type string (must be in WEBHOOK_TYPES or custom).
        payload: The webhook payload data.
        db: Supabase client instance.

    Returns:
        dict with event_id, webhook_type, status, and handler result.
    """
    event_id = str(uuid.uuid4())
    received_at = time.time()

    # Log the incoming webhook
    try:
        db.table("webhook_events").insert({
            "id": event_id,
            "webhook_type": webhook_type,
            "payload": json.dumps(payload, default=str),
            "status": "received",
            "received_at": received_at,
        }).execute()
    except Exception as exc:
        logger.warning("Could not log webhook event: %s", exc)

    # Find and execute handler
    handler = _handlers.get(webhook_type)
    if handler is None:
        logger.warning("No handler for webhook type: %s", webhook_type)
        result = {
            "event_id": event_id,
            "webhook_type": webhook_type,
            "status": "unhandled",
            "message": f"No handler registered for '{webhook_type}'",
        }
        await _update_event_status(db, event_id, "unhandled")
        return result

    try:
        handler_result = await handler(payload, db)
        duration = round(time.time() - received_at, 3)
        logger.info("Processed webhook %s (%s) in %.3fs", event_id, webhook_type, duration)
        await _update_event_status(db, event_id, "processed", handler_result)
        return {
            "event_id": event_id,
            "webhook_type": webhook_type,
            "status": "processed",
            "result": handler_result,
            "duration_seconds": duration,
        }
    except Exception as exc:
        logger.error("Webhook handler failed for %s: %s", webhook_type, exc)
        await _update_event_status(db, event_id, "failed", {"error": str(exc)})
        return {
            "event_id": event_id,
            "webhook_type": webhook_type,
            "status": "failed",
            "error": str(exc),
        }


async def register_webhook(
    name: str,
    callback_url: str,
    events: list[str],
    db: Any,
) -> dict:
    """
    Register a new webhook subscription in Supabase.

    Args:
        name: Human-readable name for this webhook registration.
        callback_url: URL to call when events fire.
        events: List of webhook_type strings to subscribe to.
        db: Supabase client instance.

    Returns:
        dict with webhook_id and confirmation.
    """
    webhook_id = str(uuid.uuid4())

    try:
        record = {
            "id": webhook_id,
            "name": name,
            "callback_url": callback_url,
            "events": json.dumps(events),
            "active": True,
            "created_at": time.time(),
        }
        db.table("webhook_registrations").insert(record).execute()
        logger.info("Registered webhook '%s' for events: %s", name, events)
        return {
            "webhook_id": webhook_id,
            "name": name,
            "events": events,
            "status": "registered",
        }
    except Exception as exc:
        logger.error("Failed to register webhook: %s", exc)
        return {"webhook_id": webhook_id, "status": "error", "error": str(exc)}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _update_event_status(
    db: Any,
    event_id: str,
    status: str,
    result: dict | None = None,
) -> None:
    """Update webhook event status in Supabase."""
    try:
        update = {"status": status, "processed_at": time.time()}
        if result:
            update["result"] = json.dumps(result, default=str)
        db.table("webhook_events").update(update).eq("id", event_id).execute()
    except Exception as exc:
        logger.warning("Could not update event status for %s: %s", event_id, exc)
