"""
Task Preview Engine - Preview changes before execution, with approval and rollback.
"""

import os
import json
import uuid
import time
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# In-memory preview store (swap to Redis/Supabase for production persistence)
_preview_store: dict[str, dict] = {}


async def _call_groq(messages: list[dict], temperature: float = 0.3) -> str:
    """Send a chat completion request to Groq."""
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 2048,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(GROQ_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def generate_preview(task: dict) -> dict:
    """
    Generate a preview of what changes a task would make, without applying them.

    Args:
        task: Parsed task dict (from ai_task_engine.parse_task()).

    Returns:
        dict with preview_id, items (list of proposed changes), and metadata.
    """
    preview_id = str(uuid.uuid4())

    prompt = (
        "You are a marketing automation preview system. For each subtask below, "
        "describe exactly what would change. Do NOT execute anything.\n\n"
        f"Task: {json.dumps(task, default=str)}\n\n"
        "Return JSON with key 'items', an array of objects with:\n"
        "  - item_id (string, sequential like 'item_1')\n"
        "  - description (what will change)\n"
        "  - target (what entity is affected)\n"
        "  - before (current state description or null)\n"
        "  - after (proposed state description)\n"
        "  - risk_level (low/medium/high)\n"
        "  - reversible (boolean)"
    )

    try:
        raw = await _call_groq([
            {"role": "system", "content": "Respond ONLY with valid JSON."},
            {"role": "user", "content": prompt},
        ])
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            cleaned = cleaned.rsplit("```", 1)[0]
        parsed = json.loads(cleaned)
        items = parsed.get("items", [])
    except (json.JSONDecodeError, httpx.HTTPStatusError) as exc:
        logger.error("Preview generation failed: %s", exc)
        items = []

    preview = {
        "preview_id": preview_id,
        "task": task,
        "items": items,
        "status": "pending_approval",
        "created_at": time.time(),
        "applied_items": [],
        "rollback_data": {},
    }
    _preview_store[preview_id] = preview

    return {
        "preview_id": preview_id,
        "items": items,
        "total_items": len(items),
        "status": "pending_approval",
    }


async def apply_preview(preview_id: str, approved_items: list[str], db: Any) -> dict:
    """
    Apply only the approved items from a preview.

    Args:
        preview_id: ID returned by generate_preview().
        approved_items: List of item_ids to apply (e.g. ["item_1", "item_3"]).
        db: Supabase client instance.

    Returns:
        dict with applied items, skipped items, and status.
    """
    preview = _preview_store.get(preview_id)
    if not preview:
        return {"preview_id": preview_id, "status": "not_found"}

    if preview["status"] == "applied":
        return {"preview_id": preview_id, "status": "already_applied"}

    applied: list[dict] = []
    skipped: list[dict] = []
    rollback_data: dict[str, dict] = {}

    for item in preview["items"]:
        item_id = item.get("item_id", "")
        if item_id in approved_items:
            try:
                # Capture state before change for rollback
                rollback_data[item_id] = {
                    "before": item.get("before"),
                    "target": item.get("target"),
                    "applied_at": time.time(),
                }
                # Persist the change
                await _apply_single_item(item, db)
                applied.append(item)
            except Exception as exc:
                logger.error("Failed to apply item %s: %s", item_id, exc)
                skipped.append({**item, "error": str(exc)})
        else:
            skipped.append(item)

    preview["status"] = "applied"
    preview["applied_items"] = [i.get("item_id") for i in applied]
    preview["rollback_data"] = rollback_data

    # Persist preview state
    try:
        db.table("previews").upsert({
            "id": preview_id,
            "status": "applied",
            "applied_items": json.dumps(preview["applied_items"]),
            "rollback_data": json.dumps(rollback_data, default=str),
            "updated_at": time.time(),
        }).execute()
    except Exception as exc:
        logger.warning("Could not persist preview state: %s", exc)

    return {
        "preview_id": preview_id,
        "status": "applied",
        "applied": [i.get("item_id") for i in applied],
        "skipped": [i.get("item_id") for i in skipped],
        "total_applied": len(applied),
        "total_skipped": len(skipped),
    }


async def rollback_changes(preview_id: str, db: Any) -> dict:
    """
    Rollback all applied changes from a preview.

    Args:
        preview_id: ID of the preview to rollback.
        db: Supabase client instance.

    Returns:
        dict with rollback status and details.
    """
    preview = _preview_store.get(preview_id)
    if not preview:
        # Try loading from database
        try:
            response = (
                db.table("previews")
                .select("*")
                .eq("id", preview_id)
                .single()
                .execute()
            )
            if response.data:
                preview = response.data
            else:
                return {"preview_id": preview_id, "status": "not_found"}
        except Exception:
            return {"preview_id": preview_id, "status": "not_found"}

    if isinstance(preview.get("rollback_data"), str):
        rollback_data = json.loads(preview["rollback_data"])
    else:
        rollback_data = preview.get("rollback_data", {})

    if not rollback_data:
        return {"preview_id": preview_id, "status": "nothing_to_rollback"}

    rolled_back: list[str] = []
    errors: list[str] = []

    for item_id, data in rollback_data.items():
        try:
            await _rollback_single_item(item_id, data, db)
            rolled_back.append(item_id)
        except Exception as exc:
            logger.error("Rollback failed for %s: %s", item_id, exc)
            errors.append(f"{item_id}: {exc}")

    # Update preview status
    new_status = "rolled_back" if not errors else "partial_rollback"
    if preview_id in _preview_store:
        _preview_store[preview_id]["status"] = new_status

    try:
        db.table("previews").update({
            "status": new_status,
            "updated_at": time.time(),
        }).eq("id", preview_id).execute()
    except Exception as exc:
        logger.warning("Could not update preview status: %s", exc)

    return {
        "preview_id": preview_id,
        "status": new_status,
        "rolled_back": rolled_back,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _apply_single_item(item: dict, db: Any) -> None:
    """Apply a single preview item. Override per task_type in production."""
    target = item.get("target", "")
    after = item.get("after", "")
    logger.info("Applying change to '%s': %s", target, after[:100] if after else "")
    # In production, this would route to the appropriate service
    # e.g., update product description, modify email template, etc.


async def _rollback_single_item(item_id: str, data: dict, db: Any) -> None:
    """Rollback a single item to its previous state."""
    target = data.get("target", "")
    before = data.get("before", "")
    logger.info("Rolling back '%s' to previous state", target)
    # In production, this would restore the original state
