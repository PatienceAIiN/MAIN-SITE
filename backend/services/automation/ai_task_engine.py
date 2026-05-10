"""
AI Task Engine - Natural language task parsing and execution via Groq AI.
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


async def _call_groq(messages: list[dict], temperature: float = 0.3) -> str:
    """Send a chat completion request to Groq and return the assistant message."""
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


async def parse_task(natural_language_input: str) -> dict:
    """
    Parse a natural language instruction into structured subtasks.

    Args:
        natural_language_input: e.g. "Optimize all product descriptions"

    Returns:
        dict with keys: original_input, subtasks (list of dicts with
        task_type, targets, parameters, priority, estimated_duration_seconds).
    """
    system_prompt = (
        "You are a marketing automation planner. Given a natural language task, "
        "break it into structured subtasks. Respond ONLY with valid JSON.\n\n"
        "Output format:\n"
        '{"subtasks": [{"task_type": "<type>", "targets": ["<target>"], '
        '"parameters": {}, "priority": "<high|medium|low>", '
        '"estimated_duration_seconds": <int>}]}\n\n'
        "Valid task_types: seo_optimize, content_generate, email_campaign, "
        "social_post, analytics_report, product_update, lead_nurture, "
        "ad_optimize, review_respond, data_sync."
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": natural_language_input},
    ]
    try:
        raw = await _call_groq(messages)
        # Strip markdown fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            cleaned = cleaned.rsplit("```", 1)[0]
        parsed = json.loads(cleaned)
        return {
            "original_input": natural_language_input,
            "subtasks": parsed.get("subtasks", []),
            "parsed_at": time.time(),
        }
    except (json.JSONDecodeError, httpx.HTTPStatusError, KeyError) as exc:
        logger.error("Failed to parse task: %s", exc)
        return {
            "original_input": natural_language_input,
            "subtasks": [],
            "error": str(exc),
            "parsed_at": time.time(),
        }


async def execute_task(task: dict, db: Any) -> dict:
    """
    Execute a parsed task by persisting it and processing each subtask.

    Args:
        task: Output from parse_task().
        db: Supabase client instance.

    Returns:
        dict with task_id, status, results per subtask.
    """
    task_id = str(uuid.uuid4())
    results: list[dict] = []

    try:
        # Persist task record
        await _upsert_task_record(db, task_id, "running", task)

        for idx, subtask in enumerate(task.get("subtasks", [])):
            subtask_id = f"{task_id}:{idx}"
            try:
                result = await _execute_subtask(subtask, db)
                results.append({
                    "subtask_id": subtask_id,
                    "task_type": subtask.get("task_type"),
                    "status": "completed",
                    "result": result,
                })
            except Exception as exc:
                logger.error("Subtask %s failed: %s", subtask_id, exc)
                results.append({
                    "subtask_id": subtask_id,
                    "task_type": subtask.get("task_type"),
                    "status": "failed",
                    "error": str(exc),
                })

        overall_status = (
            "completed"
            if all(r["status"] == "completed" for r in results)
            else "partial"
        )
        await _upsert_task_record(db, task_id, overall_status, task, results)

        return {
            "task_id": task_id,
            "status": overall_status,
            "results": results,
            "completed_at": time.time(),
        }
    except Exception as exc:
        logger.error("Task execution failed: %s", exc)
        await _upsert_task_record(db, task_id, "failed", task)
        return {"task_id": task_id, "status": "failed", "error": str(exc)}


async def estimate_workload(tasks: list[dict]) -> dict:
    """
    Estimate time, complexity, and cost for a list of parsed tasks.

    Args:
        tasks: List of parsed task dicts (from parse_task()).

    Returns:
        dict with estimated_time, complexity, cost_estimate.
    """
    total_seconds = 0
    total_subtasks = 0
    ai_calls = 0

    for task in tasks:
        subtasks = task.get("subtasks", [])
        total_subtasks += len(subtasks)
        for st in subtasks:
            duration = st.get("estimated_duration_seconds", 30)
            total_seconds += duration
            # AI-heavy task types require more Groq calls
            if st.get("task_type") in (
                "content_generate",
                "seo_optimize",
                "review_respond",
            ):
                ai_calls += 1

    complexity = "low"
    if total_subtasks > 10 or ai_calls > 5:
        complexity = "high"
    elif total_subtasks > 4 or ai_calls > 2:
        complexity = "medium"

    # Rough cost estimate: ~$0.001 per Groq call for llama-3.3-70b
    cost_estimate_usd = round(ai_calls * 0.001, 4)

    return {
        "estimated_time_seconds": total_seconds,
        "estimated_time_human": _seconds_to_human(total_seconds),
        "total_subtasks": total_subtasks,
        "ai_calls": ai_calls,
        "complexity": complexity,
        "cost_estimate_usd": cost_estimate_usd,
    }


async def get_task_status(task_id: str, db: Any) -> dict:
    """
    Retrieve current status of a task from the Supabase tasks table.

    Args:
        task_id: UUID of the task.
        db: Supabase client instance.

    Returns:
        dict with task details and status.
    """
    try:
        response = (
            db.table("tasks")
            .select("*")
            .eq("id", task_id)
            .single()
            .execute()
        )
        return response.data if response.data else {"task_id": task_id, "status": "not_found"}
    except Exception as exc:
        logger.error("Failed to fetch task status: %s", exc)
        return {"task_id": task_id, "status": "error", "error": str(exc)}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _execute_subtask(subtask: dict, db: Any) -> dict:
    """Execute a single subtask based on its task_type."""
    task_type = subtask.get("task_type", "unknown")
    targets = subtask.get("targets", [])
    parameters = subtask.get("parameters", {})

    # Generate AI content / recommendations for the subtask
    prompt = (
        f"You are a marketing automation assistant. Execute this subtask:\n"
        f"Type: {task_type}\nTargets: {targets}\nParameters: {json.dumps(parameters)}\n\n"
        f"Provide actionable output as JSON with keys: action_taken, output, suggestions."
    )
    raw = await _call_groq([
        {"role": "system", "content": "Respond ONLY with valid JSON."},
        {"role": "user", "content": prompt},
    ])
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        cleaned = cleaned.rsplit("```", 1)[0]
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"action_taken": task_type, "output": cleaned, "suggestions": []}


async def _upsert_task_record(
    db: Any,
    task_id: str,
    status: str,
    task: dict,
    results: list[dict] | None = None,
) -> None:
    """Insert or update a task record in Supabase."""
    try:
        record = {
            "id": task_id,
            "status": status,
            "original_input": task.get("original_input", ""),
            "subtasks": json.dumps(task.get("subtasks", [])),
            "results": json.dumps(results) if results else None,
            "updated_at": time.time(),
        }
        db.table("tasks").upsert(record).execute()
    except Exception as exc:
        logger.warning("Could not persist task record: %s", exc)


def _seconds_to_human(seconds: int) -> str:
    """Convert seconds to a human-readable duration string."""
    if seconds < 60:
        return f"{seconds}s"
    minutes = seconds // 60
    remaining = seconds % 60
    if minutes < 60:
        return f"{minutes}m {remaining}s"
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours}h {mins}m"
