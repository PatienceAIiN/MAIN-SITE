"""
Emotional Analysis Engine - AI-powered emotion detection, buying signal identification,
and customer satisfaction assessment.
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


async def analyze_emotion(text: str) -> dict:
    """
    Analyze the emotional content of text, returning scores for multiple emotions.

    Args:
        text: The text to analyze for emotional content.

    Returns:
        Dictionary with emotions (dict of emotion names to 0-1 scores),
        dominant_emotion (str), intensity (str), and summary (str).
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert in emotional intelligence and text analysis. "
                    "Analyze the provided text for emotional content. Return a JSON object with:\n"
                    '- "emotions": {"joy": 0.0-1.0, "anger": 0.0-1.0, "sadness": 0.0-1.0, '
                    '"fear": 0.0-1.0, "surprise": 0.0-1.0, "disgust": 0.0-1.0, '
                    '"trust": 0.0-1.0, "anticipation": 0.0-1.0}\n'
                    '- "dominant_emotion": the strongest emotion detected\n'
                    '- "intensity": "low", "medium", or "high"\n'
                    '- "valence": "positive", "neutral", or "negative"\n'
                    '- "summary": brief description of the emotional tone'
                ),
            },
            {
                "role": "user",
                "content": f"Analyze the emotions in this text:\n{text}",
            },
        ]

        result = await _call_groq(messages)

        # Normalize emotion scores to 0-1 range
        emotions = result.get("emotions", {})
        normalized_emotions = {}
        for emotion, score in emotions.items():
            try:
                normalized_emotions[emotion] = max(0.0, min(1.0, float(score)))
            except (ValueError, TypeError):
                normalized_emotions[emotion] = 0.0

        return {
            "emotions": normalized_emotions,
            "dominant_emotion": result.get("dominant_emotion", "neutral"),
            "intensity": result.get("intensity", "low"),
            "valence": result.get("valence", "neutral"),
            "summary": result.get("summary", ""),
            "analyzed_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error analyzing emotion: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error analyzing emotion: %s", str(e))
        raise


async def detect_buying_signals(messages: list) -> dict:
    """
    Detect buying signals from a list of customer messages or interactions.

    Args:
        messages: List of message dictionaries with text, sender, timestamp, and channel.

    Returns:
        Dictionary with signals (list of detected signals), confidence (0-1),
        urgency (str), recommended_action (str), and stage_indicator (str).
    """
    if not messages:
        return {
            "signals": [],
            "confidence": 0.0,
            "urgency": "none",
            "recommended_action": "No messages to analyze.",
            "stage_indicator": "unknown",
            "detected_at": datetime.utcnow().isoformat(),
        }

    try:
        messages_sample = messages[:30] if len(messages) > 30 else messages

        groq_messages = [
            {
                "role": "system",
                "content": (
                    "You are a sales intelligence expert specializing in buying signal detection. "
                    "Analyze the provided messages for buying signals. Return a JSON object with:\n"
                    '- "signals": list of objects, each with {"signal": description, '
                    '"type": category, "strength": "weak"/"moderate"/"strong"}\n'
                    '- "confidence": float 0.0-1.0 (overall confidence in buying intent)\n'
                    '- "urgency": "none", "low", "medium", "high"\n'
                    '- "recommended_action": what to do next\n'
                    '- "stage_indicator": "awareness", "consideration", "decision", "purchase"\n'
                    '- "key_phrases": phrases that indicate buying intent\n'
                    "\nBuying signals include: pricing inquiries, feature comparisons, "
                    "timeline mentions, budget discussions, stakeholder references, "
                    "implementation questions, competitor mentions, urgency language."
                ),
            },
            {
                "role": "user",
                "content": f"Detect buying signals in these messages:\n{json.dumps(messages_sample, default=str)}",
            },
        ]

        result = await _call_groq(groq_messages, max_tokens=1500)

        return {
            "signals": result.get("signals", []),
            "confidence": max(0.0, min(1.0, float(result.get("confidence", 0.0)))),
            "urgency": result.get("urgency", "none"),
            "recommended_action": result.get("recommended_action", ""),
            "stage_indicator": result.get("stage_indicator", "unknown"),
            "key_phrases": result.get("key_phrases", []),
            "detected_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error detecting buying signals: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error detecting buying signals: %s", str(e))
        raise


async def assess_customer_satisfaction(interactions: list) -> dict:
    """
    Assess overall customer satisfaction from a list of interactions.

    Args:
        interactions: List of interaction dictionaries with type, text, outcome,
                      timestamp, and channel.

    Returns:
        Dictionary with score (0-100), trend (str), risk_factors (list),
        positive_factors (list), and recommendations (list).
    """
    if not interactions:
        return {
            "score": 50,
            "trend": "stable",
            "risk_factors": [],
            "positive_factors": [],
            "recommendations": [],
            "assessed_at": datetime.utcnow().isoformat(),
        }

    try:
        interactions_sample = interactions[:40] if len(interactions) > 40 else interactions

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a customer success expert. Assess the customer's satisfaction level "
                    "based on their interactions. Return a JSON object with:\n"
                    '- "score": integer 0-100 (100 = extremely satisfied)\n'
                    '- "trend": "improving", "stable", or "declining"\n'
                    '- "risk_factors": list of factors that could lead to churn\n'
                    '- "positive_factors": list of factors indicating satisfaction\n'
                    '- "recommendations": list of actions to improve satisfaction\n'
                    '- "health_status": "healthy", "at_risk", or "critical"\n'
                    '- "nps_estimate": estimated NPS score (-100 to 100)'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Assess customer satisfaction from these {len(interactions)} interactions:\n"
                    f"{json.dumps(interactions_sample, default=str)}"
                ),
            },
        ]

        result = await _call_groq(messages, max_tokens=1500)

        return {
            "score": max(0, min(100, int(result.get("score", 50)))),
            "trend": result.get("trend", "stable"),
            "risk_factors": result.get("risk_factors", []),
            "positive_factors": result.get("positive_factors", []),
            "recommendations": result.get("recommendations", []),
            "health_status": result.get("health_status", "healthy"),
            "nps_estimate": result.get("nps_estimate"),
            "interactions_analyzed": len(interactions),
            "assessed_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error assessing satisfaction: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error assessing customer satisfaction: %s", str(e))
        raise
