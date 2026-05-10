"""
Lead Intelligence Engine - AI-powered lead scoring, classification, and conversion prediction.
Uses Groq (llama-3.3-70b-versatile) for intelligent analysis.
"""

import os
import json
import logging
from datetime import datetime
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


def _groq_headers() -> dict:
    return {
        "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}",
        "Content-Type": "application/json",
    }


async def _call_groq(messages: list, temperature: float = 0.3, max_tokens: int = 1024) -> dict:
    """Make a request to Groq API and return parsed JSON response."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GROQ_API_URL,
            headers=_groq_headers(),
            json={
                "model": GROQ_MODEL,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)


async def score_lead(lead_data: dict) -> dict:
    """
    Score a lead from 0-100 based on engagement, source, behavior, and profile data.

    Args:
        lead_data: Dictionary containing lead information such as name, email, source,
                   engagement_score, page_views, email_opens, form_submissions, etc.

    Returns:
        Dictionary with score (0-100), breakdown (dict of factor scores),
        reasoning (str), and scored_at (ISO timestamp).
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a lead scoring expert for a marketing automation platform. "
                    "Analyze the provided lead data and return a JSON object with:\n"
                    '- "score": integer 0-100\n'
                    '- "breakdown": {"engagement": 0-25, "fit": 0-25, "behavior": 0-25, "recency": 0-25}\n'
                    '- "reasoning": brief explanation of the score\n'
                    '- "tier": one of "hot", "warm", "cold"\n'
                    "Score based on: engagement level, source quality, behavioral signals, "
                    "profile completeness, and recency of activity."
                ),
            },
            {
                "role": "user",
                "content": f"Score this lead:\n{json.dumps(lead_data, default=str)}",
            },
        ]

        result = await _call_groq(messages)

        return {
            "score": max(0, min(100, int(result.get("score", 50)))),
            "breakdown": result.get("breakdown", {}),
            "reasoning": result.get("reasoning", ""),
            "tier": result.get("tier", "warm"),
            "scored_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error scoring lead: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error scoring lead: %s", str(e))
        raise


async def classify_lead_stage(lead_data: dict) -> str:
    """
    Classify a lead into a pipeline stage based on their data and behavior.

    Args:
        lead_data: Dictionary containing lead information and interaction history.

    Returns:
        Stage string: one of 'new', 'qualified', 'engaged', 'opportunity', 'customer'.
    """
    valid_stages = ["new", "qualified", "engaged", "opportunity", "customer"]

    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a sales pipeline expert. Classify the lead into exactly one stage. "
                    "Return a JSON object with:\n"
                    '- "stage": one of "new", "qualified", "engaged", "opportunity", "customer"\n'
                    '- "confidence": float 0-1\n'
                    '- "reasoning": brief explanation\n\n'
                    "Stage definitions:\n"
                    "- new: Just entered the system, minimal information\n"
                    "- qualified: Matches ICP, has shown initial interest\n"
                    "- engaged: Active engagement (multiple interactions, content consumption)\n"
                    "- opportunity: Demonstrated buying intent (demo request, pricing page, etc.)\n"
                    "- customer: Has made a purchase or signed up"
                ),
            },
            {
                "role": "user",
                "content": f"Classify this lead:\n{json.dumps(lead_data, default=str)}",
            },
        ]

        result = await _call_groq(messages)
        stage = result.get("stage", "new").lower().strip()

        if stage not in valid_stages:
            logger.warning("Invalid stage '%s' returned, defaulting to 'new'", stage)
            return "new"

        return stage

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error classifying lead: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error classifying lead stage: %s", str(e))
        raise


async def predict_conversion(lead_data: dict) -> dict:
    """
    Predict the probability of a lead converting to a customer.

    Args:
        lead_data: Dictionary containing lead information, engagement data, and history.

    Returns:
        Dictionary with probability (0-1), confidence (0-1), reasoning (str),
        key_factors (list), and predicted_at (ISO timestamp).
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a conversion prediction expert. Analyze the lead data and predict "
                    "the likelihood of conversion. Return a JSON object with:\n"
                    '- "probability": float 0.0-1.0 (likelihood of conversion)\n'
                    '- "confidence": float 0.0-1.0 (how confident you are in this prediction)\n'
                    '- "reasoning": detailed explanation\n'
                    '- "key_factors": list of top 3-5 factors influencing the prediction\n'
                    '- "time_to_convert_days": estimated days until conversion (null if unlikely)\n'
                    '- "risk_factors": list of factors that could prevent conversion'
                ),
            },
            {
                "role": "user",
                "content": f"Predict conversion for this lead:\n{json.dumps(lead_data, default=str)}",
            },
        ]

        result = await _call_groq(messages)

        return {
            "probability": max(0.0, min(1.0, float(result.get("probability", 0.5)))),
            "confidence": max(0.0, min(1.0, float(result.get("confidence", 0.5)))),
            "reasoning": result.get("reasoning", ""),
            "key_factors": result.get("key_factors", []),
            "time_to_convert_days": result.get("time_to_convert_days"),
            "risk_factors": result.get("risk_factors", []),
            "predicted_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error predicting conversion: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error predicting conversion: %s", str(e))
        raise


async def get_next_best_action(lead_data: dict, history: list) -> dict:
    """
    Recommend the next best action to take with a lead based on their data and interaction history.

    Args:
        lead_data: Dictionary containing current lead information.
        history: List of previous interactions/actions taken with this lead.

    Returns:
        Dictionary with action (str), priority (str), channel (str),
        reasoning (str), and suggested_content (str).
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a sales and marketing strategist. Based on the lead data and "
                    "interaction history, recommend the single best next action. "
                    "Return a JSON object with:\n"
                    '- "action": specific action to take (e.g., "send_personalized_email", '
                    '"schedule_demo", "share_case_study")\n'
                    '- "priority": "high", "medium", or "low"\n'
                    '- "channel": preferred channel (email, phone, social, in_app)\n'
                    '- "reasoning": why this action is recommended\n'
                    '- "suggested_content": brief content suggestion or talking points\n'
                    '- "timing": when to execute (e.g., "immediately", "next_business_day", '
                    '"wait_3_days")\n'
                    '- "expected_outcome": what this action should achieve'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Lead data:\n{json.dumps(lead_data, default=str)}\n\n"
                    f"Interaction history:\n{json.dumps(history, default=str)}"
                ),
            },
        ]

        result = await _call_groq(messages)

        return {
            "action": result.get("action", "follow_up_email"),
            "priority": result.get("priority", "medium"),
            "channel": result.get("channel", "email"),
            "reasoning": result.get("reasoning", ""),
            "suggested_content": result.get("suggested_content", ""),
            "timing": result.get("timing", "next_business_day"),
            "expected_outcome": result.get("expected_outcome", ""),
            "recommended_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error getting next best action: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error getting next best action: %s", str(e))
        raise
