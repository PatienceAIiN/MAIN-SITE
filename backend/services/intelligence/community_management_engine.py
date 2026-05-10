"""
Community Management Engine - AI-powered community health analysis, advocate identification,
engagement generation, and content moderation.
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


async def _call_groq(
    messages: list,
    temperature: float = 0.3,
    max_tokens: int = 1024,
    json_response: bool = True,
) -> dict | str:
    """Make a request to Groq API and return parsed response."""
    payload: dict = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_response:
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GROQ_API_URL,
            headers=_groq_headers(),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        if json_response:
            return json.loads(content)
        return content


async def analyze_community_health(metrics: dict) -> dict:
    """
    Analyze the overall health of a community based on engagement and growth metrics.

    Args:
        metrics: Dictionary with member_count, active_members, posts_per_day,
                 replies_per_post, new_members_this_week, churn_rate, and
                 sentiment_scores.

    Returns:
        Dictionary with health_score (0-100), engagement_rate (float),
        growth_trend (str), sentiment (str), risks (list), and recommendations (list).
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a community management expert. Analyze the provided community "
                    "metrics and assess overall health. Return a JSON object with:\n"
                    '- "health_score": integer 0-100 (100 = thriving community)\n'
                    '- "engagement_rate": float 0.0-1.0\n'
                    '- "growth_trend": "rapid_growth", "steady_growth", "stable", '
                    '"slow_decline", or "rapid_decline"\n'
                    '- "sentiment": "very_positive", "positive", "neutral", "negative", '
                    'or "very_negative"\n'
                    '- "risks": list of community health risks\n'
                    '- "strengths": list of community strengths\n'
                    '- "recommendations": list of actions to improve community health\n'
                    '- "benchmarks": how metrics compare to healthy community standards'
                ),
            },
            {
                "role": "user",
                "content": f"Analyze community health from these metrics:\n{json.dumps(metrics, default=str)}",
            },
        ]

        result = await _call_groq(messages)

        return {
            "health_score": max(0, min(100, int(result.get("health_score", 50)))),
            "engagement_rate": max(0.0, min(1.0, float(result.get("engagement_rate", 0.0)))),
            "growth_trend": result.get("growth_trend", "stable"),
            "sentiment": result.get("sentiment", "neutral"),
            "risks": result.get("risks", []),
            "strengths": result.get("strengths", []),
            "recommendations": result.get("recommendations", []),
            "benchmarks": result.get("benchmarks", {}),
            "analyzed_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error analyzing community health: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error analyzing community health: %s", str(e))
        raise


async def identify_advocates(members: list) -> list:
    """
    Identify top community advocates from a list of members based on their activity and influence.

    Args:
        members: List of member dictionaries with name, posts_count, replies_count,
                 helpful_votes, member_since, engagement_score, and referrals.

    Returns:
        List of advocate dictionaries with member info, influence_score (0-100),
        advocate_type (str), and recommended_engagement (str).
    """
    if not members:
        return []

    try:
        members_sample = members[:50] if len(members) > 50 else members

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a community management expert specializing in advocate programs. "
                    "Identify the top advocates from the member list. Return a JSON object with:\n"
                    '- "advocates": list of objects, each with:\n'
                    '  - "member_index": index in the input list (0-based)\n'
                    '  - "influence_score": integer 0-100\n'
                    '  - "advocate_type": "thought_leader", "helper", "connector", '
                    '"content_creator", or "evangelist"\n'
                    '  - "strengths": list of key strengths\n'
                    '  - "recommended_engagement": how to engage this advocate\n'
                    '  - "potential_role": suggested community role\n'
                    "\nRank by overall influence considering: activity volume, quality of "
                    "contributions, helpfulness, tenure, and network effects. "
                    "Return top 10 or fewer advocates."
                ),
            },
            {
                "role": "user",
                "content": f"Identify advocates from these {len(members)} members:\n{json.dumps(members_sample, default=str)}",
            },
        ]

        result = await _call_groq(messages, max_tokens=2000)

        advocates = result.get("advocates", [])

        # Enrich with original member data
        enriched = []
        for advocate in advocates:
            if not isinstance(advocate, dict):
                continue
            idx = advocate.get("member_index")
            member_data = {}
            if isinstance(idx, int) and 0 <= idx < len(members_sample):
                member_data = members_sample[idx]

            enriched.append({
                "member": member_data,
                "influence_score": max(0, min(100, int(advocate.get("influence_score", 0)))),
                "advocate_type": advocate.get("advocate_type", "helper"),
                "strengths": advocate.get("strengths", []),
                "recommended_engagement": advocate.get("recommended_engagement", ""),
                "potential_role": advocate.get("potential_role", ""),
            })

        return enriched

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error identifying advocates: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error identifying advocates: %s", str(e))
        raise


async def generate_engagement_prompt(community_context: dict) -> str:
    """
    Generate a discussion starter or engagement prompt tailored to the community.

    Args:
        community_context: Dictionary with community_name, topics, recent_discussions,
                           member_interests, and tone.

    Returns:
        Generated engagement prompt string ready to post.
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a community engagement specialist. Generate a compelling "
                    "discussion starter that will drive community participation. "
                    "Return a JSON object with:\n"
                    '- "prompt": the discussion starter text (ready to post)\n'
                    '- "expected_engagement": "low", "medium", or "high"\n'
                    '- "topic_category": category of the discussion\n'
                    "\nThe prompt should be:\n"
                    "- Relevant to the community's interests\n"
                    "- Open-ended to encourage diverse responses\n"
                    "- Authentic and not overly corporate\n"
                    "- Concise but thought-provoking"
                ),
            },
            {
                "role": "user",
                "content": f"Generate an engagement prompt for this community:\n{json.dumps(community_context, default=str)}",
            },
        ]

        result = await _call_groq(messages, temperature=0.7)

        return result.get("prompt", "")

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error generating engagement prompt: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error generating engagement prompt: %s", str(e))
        raise


async def moderate_content(text: str) -> dict:
    """
    Moderate user-generated content for appropriateness and policy compliance.

    Args:
        text: The text content to moderate.

    Returns:
        Dictionary with is_appropriate (bool), flags (list), confidence (0-1),
        category (str), and suggested_action (str).
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a content moderation expert. Evaluate the provided text for "
                    "community guideline compliance. Return a JSON object with:\n"
                    '- "is_appropriate": boolean (safe to publish)\n'
                    '- "flags": list of policy violations or concerns, each with '
                    '{"type": category, "severity": "low"/"medium"/"high", "detail": explanation}\n'
                    '- "confidence": float 0.0-1.0 (confidence in the assessment)\n'
                    '- "category": "safe", "needs_review", "spam", "harassment", '
                    '"hate_speech", "misinformation", "self_promotion", or "inappropriate"\n'
                    '- "suggested_action": "approve", "flag_for_review", "remove", or "warn_user"\n'
                    '- "reasoning": brief explanation\n'
                    "\nCheck for: harassment, hate speech, spam, self-promotion, "
                    "misinformation, explicit content, personal attacks, and doxxing. "
                    "When in doubt, flag for human review."
                ),
            },
            {
                "role": "user",
                "content": f"Moderate this content:\n{text}",
            },
        ]

        result = await _call_groq(messages, temperature=0.1)

        return {
            "is_appropriate": bool(result.get("is_appropriate", True)),
            "flags": result.get("flags", []),
            "confidence": max(0.0, min(1.0, float(result.get("confidence", 0.5)))),
            "category": result.get("category", "safe"),
            "suggested_action": result.get("suggested_action", "approve"),
            "reasoning": result.get("reasoning", ""),
            "moderated_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error moderating content: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error moderating content: %s", str(e))
        raise
