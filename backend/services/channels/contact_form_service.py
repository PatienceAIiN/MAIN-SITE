import os
import json
from datetime import datetime, timezone
from typing import Any

import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


async def _groq_chat(system: str, prompt: str, temperature: float = 0.5, max_tokens: int = 500) -> dict:
    """Internal helper – calls Groq chat completions and returns parsed JSON."""
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return json.loads(data["choices"][0]["message"]["content"])


async def process_submission(form_data: dict[str, Any]) -> dict[str, Any]:
    """Process an incoming contact-form submission.

    Steps:
        1. Classify the intent of the message.
        2. Score the lead (0-100).
        3. Generate an auto-reply draft.

    form_data expected keys: name, email, phone (optional), message, source (optional).
    """
    name = form_data.get("name", "")
    email_addr = form_data.get("email", "")
    message = form_data.get("message", "")
    source = form_data.get("source", "website")

    if not message:
        return {"error": "Empty message in form submission"}

    try:
        prompt = (
            f"A website visitor submitted a contact form.\n"
            f"Name: {name}\nEmail: {email_addr}\nSource: {source}\n"
            f"Message: {message[:1500]}\n\n"
            "Return ONLY valid JSON with:\n"
            "- intent: one of (inquiry, demo_request, support, partnership, complaint, spam)\n"
            "- lead_score: integer 0-100 (100 = hot lead)\n"
            "- lead_score_reasoning: one sentence explaining the score\n"
            "- auto_reply: a friendly, professional auto-reply message (max 150 words)\n"
            "- tags: list of 1-3 tags for CRM categorisation"
        )
        result = await _groq_chat(
            system="You are a CRM lead-scoring and auto-reply expert. Return only valid JSON.",
            prompt=prompt,
            temperature=0.4,
            max_tokens=500,
        )

        return {
            "submission": {
                "name": name,
                "email": email_addr,
                "message": message,
                "source": source,
                "received_at": datetime.now(timezone.utc).isoformat(),
            },
            "classification": {
                "intent": result.get("intent", "inquiry"),
                "lead_score": result.get("lead_score", 0),
                "lead_score_reasoning": result.get("lead_score_reasoning", ""),
                "tags": result.get("tags", []),
            },
            "auto_reply": result.get("auto_reply", ""),
        }
    except Exception as exc:
        return {"error": f"Failed to process submission: {exc}"}


async def get_submissions(db: Any) -> dict[str, Any]:
    """Fetch contact-form submissions from Supabase.

    Args:
        db: A Supabase client instance (from supabase-py).
    """
    try:
        response = (
            db.table("contact_form_submissions")
            .select("*")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        submissions = response.data if hasattr(response, "data") else []
        return {"submissions": submissions, "count": len(submissions)}
    except Exception as exc:
        return {"error": f"Failed to fetch submissions from database: {exc}"}
