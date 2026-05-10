"""
Automation Scheduler - Daily automation cycles and task scheduling.
"""

import os
import json
import uuid
import time
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


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


async def run_daily_cycle(db: Any) -> dict:
    """
    Execute the full daily automation cycle:
    1. Sync external data sources
    2. Analyze recent performance metrics
    3. Detect opportunities and issues
    4. Generate actionable recommendations

    Args:
        db: Supabase client instance.

    Returns:
        dict summarizing the cycle results.
    """
    cycle_id = str(uuid.uuid4())
    started_at = time.time()
    results: dict[str, Any] = {"cycle_id": cycle_id, "steps": {}}

    try:
        # Step 1: Sync data
        sync_result = await _sync_data(db)
        results["steps"]["data_sync"] = sync_result

        # Step 2: Analyze performance
        perf_result = await _analyze_performance(db)
        results["steps"]["performance_analysis"] = perf_result

        # Step 3: Detect opportunities
        opportunities = await _detect_opportunities(perf_result, db)
        results["steps"]["opportunities"] = opportunities

        # Step 4: Generate recommendations via AI
        recommendations = await _generate_recommendations(perf_result, opportunities)
        results["steps"]["recommendations"] = recommendations

        results["status"] = "completed"
        results["duration_seconds"] = round(time.time() - started_at, 2)

        # Persist cycle record
        await _save_cycle_record(db, results)

        return results
    except Exception as exc:
        logger.error("Daily cycle failed: %s", exc)
        results["status"] = "failed"
        results["error"] = str(exc)
        results["duration_seconds"] = round(time.time() - started_at, 2)
        return results


async def schedule_task(task: dict, run_at: str, db: Any) -> dict:
    """
    Schedule a task for future execution.

    Args:
        task: Task definition dict (from ai_task_engine.parse_task or manual).
        run_at: ISO 8601 datetime string for when to execute.
        db: Supabase client instance.

    Returns:
        dict with schedule_id and confirmation.
    """
    schedule_id = str(uuid.uuid4())
    record = {
        "id": schedule_id,
        "task": json.dumps(task),
        "run_at": run_at,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        db.table("scheduled_tasks").insert(record).execute()
        logger.info("Scheduled task %s for %s", schedule_id, run_at)
        return {
            "schedule_id": schedule_id,
            "run_at": run_at,
            "status": "pending",
        }
    except Exception as exc:
        logger.error("Failed to schedule task: %s", exc)
        return {"schedule_id": schedule_id, "status": "error", "error": str(exc)}


async def get_scheduled_tasks(db: Any) -> list[dict]:
    """
    List all pending scheduled tasks ordered by run_at.

    Args:
        db: Supabase client instance.

    Returns:
        List of scheduled task dicts.
    """
    try:
        response = (
            db.table("scheduled_tasks")
            .select("*")
            .eq("status", "pending")
            .order("run_at", desc=False)
            .execute()
        )
        return response.data or []
    except Exception as exc:
        logger.error("Failed to list scheduled tasks: %s", exc)
        return []


async def cancel_task(task_id: str, db: Any) -> dict:
    """
    Cancel a scheduled task.

    Args:
        task_id: ID of the scheduled task.
        db: Supabase client instance.

    Returns:
        dict with cancellation status.
    """
    try:
        response = (
            db.table("scheduled_tasks")
            .update({"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", task_id)
            .eq("status", "pending")
            .execute()
        )
        if response.data:
            logger.info("Cancelled task %s", task_id)
            return {"task_id": task_id, "status": "cancelled"}
        return {"task_id": task_id, "status": "not_found_or_already_executed"}
    except Exception as exc:
        logger.error("Failed to cancel task: %s", exc)
        return {"task_id": task_id, "status": "error", "error": str(exc)}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _sync_data(db: Any) -> dict:
    """Sync data from configured external sources."""
    synced_sources: list[str] = []
    errors: list[str] = []

    # Fetch configured integrations
    try:
        response = db.table("integrations").select("*").eq("active", True).execute()
        integrations = response.data or []
    except Exception:
        integrations = []

    for integration in integrations:
        source = integration.get("source", "unknown")
        try:
            # Each integration would have its own sync logic; placeholder here
            logger.info("Syncing data from %s", source)
            synced_sources.append(source)
        except Exception as exc:
            errors.append(f"{source}: {exc}")

    return {
        "synced_sources": synced_sources,
        "errors": errors,
        "total": len(synced_sources),
    }


async def _analyze_performance(db: Any) -> dict:
    """Pull recent metrics and compute performance summary."""
    try:
        response = (
            db.table("metrics")
            .select("*")
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        metrics = response.data or []
    except Exception:
        metrics = []

    return {
        "metrics_analyzed": len(metrics),
        "raw_metrics": metrics[:20],  # Keep top 20 for AI analysis
    }


async def _detect_opportunities(perf_data: dict, db: Any) -> list[dict]:
    """Use AI to detect marketing opportunities from performance data."""
    if not perf_data.get("raw_metrics"):
        return []

    prompt = (
        "Analyze these marketing metrics and identify opportunities:\n"
        f"{json.dumps(perf_data['raw_metrics'][:10], default=str)}\n\n"
        "Return JSON array of opportunities with keys: type, description, "
        "potential_impact (high/medium/low), suggested_action."
    )
    try:
        raw = await _call_groq([
            {"role": "system", "content": "You are a marketing analyst. Respond ONLY with valid JSON."},
            {"role": "user", "content": prompt},
        ])
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            cleaned = cleaned.rsplit("```", 1)[0]
        return json.loads(cleaned)
    except (json.JSONDecodeError, httpx.HTTPStatusError) as exc:
        logger.warning("Opportunity detection failed: %s", exc)
        return []


async def _generate_recommendations(perf_data: dict, opportunities: list[dict]) -> list[dict]:
    """Generate actionable recommendations from analysis results."""
    prompt = (
        "Based on this performance data and detected opportunities, "
        "generate 3-5 prioritized marketing recommendations.\n\n"
        f"Performance: {json.dumps(perf_data.get('raw_metrics', [])[:5], default=str)}\n"
        f"Opportunities: {json.dumps(opportunities[:5], default=str)}\n\n"
        "Return JSON array with keys: recommendation, priority (1-5), "
        "effort (low/medium/high), expected_impact, action_steps[]."
    )
    try:
        raw = await _call_groq([
            {"role": "system", "content": "You are a marketing strategist. Respond ONLY with valid JSON."},
            {"role": "user", "content": prompt},
        ])
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            cleaned = cleaned.rsplit("```", 1)[0]
        return json.loads(cleaned)
    except (json.JSONDecodeError, httpx.HTTPStatusError) as exc:
        logger.warning("Recommendation generation failed: %s", exc)
        return []


async def _save_cycle_record(db: Any, results: dict) -> None:
    """Persist daily cycle results to Supabase."""
    try:
        record = {
            "id": results["cycle_id"],
            "status": results.get("status", "unknown"),
            "results": json.dumps(results, default=str),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        db.table("daily_cycles").insert(record).execute()
    except Exception as exc:
        logger.warning("Could not save cycle record: %s", exc)
