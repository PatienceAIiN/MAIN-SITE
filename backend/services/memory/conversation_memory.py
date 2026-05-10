"""
Conversation Memory - Stores and retrieves customer interaction history.
"""

import os
import json
import uuid
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


async def store_interaction(
    customer_id: str,
    channel: str,
    message: str,
    response: str,
    metadata: dict,
    db: Any,
) -> dict:
    """
    Store a customer interaction in the conversation history.

    Args:
        customer_id: Unique customer identifier.
        channel: Communication channel (email, chat, instagram, whatsapp, etc.).
        message: The customer's message.
        response: The response that was sent.
        metadata: Additional context (sentiment, intent, agent_id, etc.).
        db: Supabase client instance.

    Returns:
        dict with interaction_id and confirmation.
    """
    interaction_id = str(uuid.uuid4())
    record = {
        "id": interaction_id,
        "customer_id": customer_id,
        "channel": channel,
        "message": message,
        "response": response,
        "metadata": json.dumps(metadata),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        db.table("conversations").insert(record).execute()
        logger.info(
            "Stored interaction %s for customer %s on %s",
            interaction_id, customer_id, channel,
        )
        return {
            "interaction_id": interaction_id,
            "customer_id": customer_id,
            "channel": channel,
            "status": "stored",
        }
    except Exception as exc:
        logger.error("Failed to store interaction: %s", exc)
        return {
            "interaction_id": interaction_id,
            "status": "error",
            "error": str(exc),
        }


async def get_context(customer_id: str, limit: int, db: Any) -> list[dict]:
    """
    Retrieve recent interactions for a customer.

    Args:
        customer_id: Unique customer identifier.
        limit: Maximum number of interactions to return.
        db: Supabase client instance.

    Returns:
        List of interaction dicts ordered by most recent first.
    """
    try:
        response = (
            db.table("conversations")
            .select("*")
            .eq("customer_id", customer_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        interactions = response.data or []
        # Parse metadata JSON strings back to dicts
        for interaction in interactions:
            if isinstance(interaction.get("metadata"), str):
                try:
                    interaction["metadata"] = json.loads(interaction["metadata"])
                except json.JSONDecodeError:
                    pass
        return interactions
    except Exception as exc:
        logger.error("Failed to get context for customer %s: %s", customer_id, exc)
        return []


async def summarize_history(customer_id: str, db: Any) -> str:
    """
    Generate an AI summary of a customer's conversation history.

    Args:
        customer_id: Unique customer identifier.
        db: Supabase client instance.

    Returns:
        A concise summary string of the customer's interaction history.
    """
    interactions = await get_context(customer_id, limit=50, db=db)

    if not interactions:
        return f"No conversation history found for customer {customer_id}."

    # Build conversation timeline for the AI
    timeline: list[str] = []
    for ix in reversed(interactions):  # Chronological order
        channel = ix.get("channel", "unknown")
        message = ix.get("message", "")
        response = ix.get("response", "")
        created = ix.get("created_at", "")
        timeline.append(
            f"[{created}] ({channel}) Customer: {message[:200]}\nAgent: {response[:200]}"
        )

    conversation_text = "\n---\n".join(timeline[-20:])  # Last 20 for context window

    prompt = (
        "Summarize this customer's conversation history. Include:\n"
        "- Key topics discussed\n"
        "- Customer sentiment trend\n"
        "- Unresolved issues\n"
        "- Purchase intent signals\n"
        "- Preferred communication channel\n\n"
        f"Customer ID: {customer_id}\n"
        f"Total interactions: {len(interactions)}\n\n"
        f"Recent conversations:\n{conversation_text}"
    )

    try:
        summary = await _call_groq([
            {
                "role": "system",
                "content": (
                    "You are a customer relationship analyst. Provide a concise, "
                    "actionable summary of the customer's history in 3-5 sentences."
                ),
            },
            {"role": "user", "content": prompt},
        ])
        return summary.strip()
    except (httpx.HTTPStatusError, Exception) as exc:
        logger.error("Failed to summarize history for %s: %s", customer_id, exc)
        return (
            f"Summary unavailable. Customer has {len(interactions)} interactions "
            f"across channels: {', '.join(set(i.get('channel', '?') for i in interactions))}."
        )
