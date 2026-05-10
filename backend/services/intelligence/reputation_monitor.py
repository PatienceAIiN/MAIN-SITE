"""
Reputation Monitor - AI-powered brand mention analysis, reputation scoring, and crisis detection.
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


async def analyze_mention(text: str, source: str) -> dict:
    """
    Analyze a brand mention for sentiment, risk level, and whether it requires a response.

    Args:
        text: The text content of the mention.
        source: Where the mention was found (e.g., 'twitter', 'reddit', 'review_site').

    Returns:
        Dictionary with sentiment (str), sentiment_score (-1 to 1), risk_level (str),
        requires_response (bool), topics (list), and urgency (str).
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a brand reputation analyst. Analyze the provided mention and "
                    "return a JSON object with:\n"
                    '- "sentiment": "positive", "neutral", or "negative"\n'
                    '- "sentiment_score": float from -1.0 (very negative) to 1.0 (very positive)\n'
                    '- "risk_level": "none", "low", "medium", "high", or "critical"\n'
                    '- "requires_response": boolean\n'
                    '- "topics": list of key topics mentioned\n'
                    '- "urgency": "none", "low", "medium", "high"\n'
                    '- "potential_reach": "low", "medium", "high" (estimated audience impact)\n'
                    '- "key_phrases": list of notable phrases from the mention'
                ),
            },
            {
                "role": "user",
                "content": f"Source: {source}\nMention text: {text}",
            },
        ]

        result = await _call_groq(messages)

        return {
            "sentiment": result.get("sentiment", "neutral"),
            "sentiment_score": max(-1.0, min(1.0, float(result.get("sentiment_score", 0.0)))),
            "risk_level": result.get("risk_level", "none"),
            "requires_response": bool(result.get("requires_response", False)),
            "topics": result.get("topics", []),
            "urgency": result.get("urgency", "none"),
            "potential_reach": result.get("potential_reach", "low"),
            "key_phrases": result.get("key_phrases", []),
            "analyzed_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error analyzing mention: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error analyzing mention: %s", str(e))
        raise


async def calculate_reputation_score(mentions: list) -> dict:
    """
    Calculate an overall reputation score from a collection of mentions.

    Args:
        mentions: List of mention dictionaries, each containing text, source,
                  sentiment, and timestamp.

    Returns:
        Dictionary with overall_score (0-100), trend (str), sentiment_distribution (dict),
        alerts (list), and summary (str).
    """
    if not mentions:
        return {
            "overall_score": 50,
            "trend": "stable",
            "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
            "alerts": [],
            "summary": "No mentions to analyze.",
            "calculated_at": datetime.utcnow().isoformat(),
        }

    try:
        # Truncate mentions list if too large to fit in context
        mentions_sample = mentions[:50] if len(mentions) > 50 else mentions

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a reputation analytics expert. Analyze the collection of brand "
                    "mentions and calculate an overall reputation score. Return a JSON object with:\n"
                    '- "overall_score": integer 0-100 (100 = excellent reputation)\n'
                    '- "trend": "improving", "stable", or "declining"\n'
                    '- "sentiment_distribution": {"positive": count, "neutral": count, "negative": count}\n'
                    '- "alerts": list of concerning items that need attention\n'
                    '- "summary": brief overall reputation summary\n'
                    '- "top_positive_themes": list of recurring positive themes\n'
                    '- "top_negative_themes": list of recurring negative themes\n'
                    '- "recommendation": what to focus on to improve reputation'
                ),
            },
            {
                "role": "user",
                "content": f"Analyze these {len(mentions)} mentions:\n{json.dumps(mentions_sample, default=str)}",
            },
        ]

        result = await _call_groq(messages, max_tokens=1500)

        return {
            "overall_score": max(0, min(100, int(result.get("overall_score", 50)))),
            "trend": result.get("trend", "stable"),
            "sentiment_distribution": result.get("sentiment_distribution", {}),
            "alerts": result.get("alerts", []),
            "summary": result.get("summary", ""),
            "top_positive_themes": result.get("top_positive_themes", []),
            "top_negative_themes": result.get("top_negative_themes", []),
            "recommendation": result.get("recommendation", ""),
            "mentions_analyzed": len(mentions),
            "calculated_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error calculating reputation score: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error calculating reputation score: %s", str(e))
        raise


async def detect_crisis(mentions: list) -> dict:
    """
    Detect if a set of mentions indicates a brand crisis situation.

    Args:
        mentions: List of recent mention dictionaries with text, source, sentiment, timestamp.

    Returns:
        Dictionary with is_crisis (bool), severity (str), recommended_action (str),
        trigger_mentions (list), and escalation_needed (bool).
    """
    if not mentions:
        return {
            "is_crisis": False,
            "severity": "none",
            "recommended_action": "No mentions to analyze.",
            "trigger_mentions": [],
            "escalation_needed": False,
            "detected_at": datetime.utcnow().isoformat(),
        }

    try:
        mentions_sample = mentions[:30] if len(mentions) > 30 else mentions

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a crisis communications expert. Analyze the provided mentions to "
                    "determine if there is a brand crisis developing. Return a JSON object with:\n"
                    '- "is_crisis": boolean\n'
                    '- "severity": "none", "low", "medium", "high", or "critical"\n'
                    '- "crisis_type": type of crisis if detected (e.g., "product_issue", '
                    '"pr_scandal", "service_outage", "data_breach", "none")\n'
                    '- "recommended_action": specific action to take\n'
                    '- "trigger_mentions": indices of the most concerning mentions (0-based)\n'
                    '- "escalation_needed": boolean - should leadership be notified\n'
                    '- "response_timeline": how quickly to respond (e.g., "within_1_hour", '
                    '"within_24_hours")\n'
                    '- "talking_points": list of recommended talking points for response'
                ),
            },
            {
                "role": "user",
                "content": f"Analyze these mentions for crisis signals:\n{json.dumps(mentions_sample, default=str)}",
            },
        ]

        result = await _call_groq(messages, max_tokens=1500)

        return {
            "is_crisis": bool(result.get("is_crisis", False)),
            "severity": result.get("severity", "none"),
            "crisis_type": result.get("crisis_type", "none"),
            "recommended_action": result.get("recommended_action", ""),
            "trigger_mentions": result.get("trigger_mentions", []),
            "escalation_needed": bool(result.get("escalation_needed", False)),
            "response_timeline": result.get("response_timeline", ""),
            "talking_points": result.get("talking_points", []),
            "detected_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error detecting crisis: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error detecting crisis: %s", str(e))
        raise


async def generate_response(mention: dict, brand_voice: str) -> str:
    """
    Generate a brand-appropriate response to a mention.

    Args:
        mention: Dictionary containing the mention text, source, sentiment, and context.
        brand_voice: Description of the brand's tone and voice (e.g., 'professional and empathetic').

    Returns:
        Generated response string appropriate for the platform and brand voice.
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a brand communications specialist. Generate a response to the "
                    "provided mention that matches the specified brand voice. "
                    "Return a JSON object with:\n"
                    '- "response": the crafted response text\n'
                    '- "tone": the tone used\n'
                    '- "platform_appropriate": boolean (is the response suitable for the platform)\n'
                    "\nKeep the response concise, authentic, and platform-appropriate. "
                    "Do not be overly corporate or use excessive jargon."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Brand voice: {brand_voice}\n"
                    f"Mention: {json.dumps(mention, default=str)}\n"
                    "Generate a response."
                ),
            },
        ]

        result = await _call_groq(messages, temperature=0.5)

        return result.get("response", "")

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error generating response: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error generating response: %s", str(e))
        raise
