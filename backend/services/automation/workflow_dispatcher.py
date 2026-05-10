"""
Workflow Dispatcher - Routes actions to the appropriate service handlers.
"""

import time
import uuid
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Registry of known action handlers.
# Each handler is an async callable(payload: dict) -> dict.
_ACTION_HANDLERS: dict[str, Any] = {}


def register_handler(action: str, handler: Any) -> None:
    """Register an async handler for a given action name."""
    _ACTION_HANDLERS[action] = handler
    logger.info("Registered dispatch handler for action: %s", action)


async def dispatch(action: str, payload: dict) -> dict:
    """
    Route an action to its registered handler, or return an error.

    Args:
        action: Action name, e.g. "seo_optimize", "send_email", "generate_content".
        payload: Arbitrary payload dict passed to the handler.

    Returns:
        dict with dispatch_id, action, status, and result or error.
    """
    dispatch_id = str(uuid.uuid4())
    started_at = time.time()

    handler = _ACTION_HANDLERS.get(action)
    if handler is None:
        logger.warning("No handler registered for action: %s", action)
        return {
            "dispatch_id": dispatch_id,
            "action": action,
            "status": "unhandled",
            "error": f"No handler registered for action '{action}'",
            "duration_seconds": 0,
        }

    try:
        result = await handler(payload)
        duration = round(time.time() - started_at, 3)
        logger.info("Dispatched %s in %.3fs", action, duration)
        return {
            "dispatch_id": dispatch_id,
            "action": action,
            "status": "completed",
            "result": result,
            "duration_seconds": duration,
        }
    except Exception as exc:
        duration = round(time.time() - started_at, 3)
        logger.error("Dispatch failed for %s: %s", action, exc)
        return {
            "dispatch_id": dispatch_id,
            "action": action,
            "status": "failed",
            "error": str(exc),
            "duration_seconds": duration,
        }


async def get_dispatch_log(limit: int, db: Any) -> list[dict]:
    """
    Retrieve recent dispatch log entries from Supabase.

    Args:
        limit: Maximum number of entries to return.
        db: Supabase client instance.

    Returns:
        List of dispatch log dicts ordered by most recent first.
    """
    try:
        response = (
            db.table("dispatch_log")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as exc:
        logger.error("Failed to fetch dispatch log: %s", exc)
        return []
