"""
Business Context Engine - AI-powered business question answering, insight generation,
and strategic recommendations.
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


async def analyze_business_context(query: str, data: dict) -> dict:
    """
    Answer business questions using AI analysis of provided data.

    Args:
        query: The business question to answer (e.g., "Why did engagement drop last week?").
        data: Dictionary containing relevant business data, metrics, and context.

    Returns:
        Dictionary with answer (str), confidence (0-1), supporting_data (list),
        follow_up_questions (list), and data_gaps (list).
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a senior business analyst and strategic advisor. Answer the "
                    "business question using the provided data. Return a JSON object with:\n"
                    '- "answer": clear, actionable answer to the question\n'
                    '- "confidence": float 0.0-1.0 (how confident in the analysis)\n'
                    '- "supporting_data": list of key data points that support the answer\n'
                    '- "follow_up_questions": list of questions that would deepen the analysis\n'
                    '- "data_gaps": information that would improve the answer if available\n'
                    '- "executive_summary": 1-2 sentence summary for leadership\n'
                    '- "action_items": specific next steps based on the analysis\n'
                    "\nBe data-driven, specific, and avoid vague generalities."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Question: {query}\n\n"
                    f"Available data:\n{json.dumps(data, default=str)}"
                ),
            },
        ]

        result = await _call_groq(messages, max_tokens=2000)

        return {
            "answer": result.get("answer", ""),
            "confidence": max(0.0, min(1.0, float(result.get("confidence", 0.5)))),
            "supporting_data": result.get("supporting_data", []),
            "follow_up_questions": result.get("follow_up_questions", []),
            "data_gaps": result.get("data_gaps", []),
            "executive_summary": result.get("executive_summary", ""),
            "action_items": result.get("action_items", []),
            "query": query,
            "analyzed_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error analyzing business context: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error analyzing business context: %s", str(e))
        raise


async def generate_insights(metrics: dict) -> list:
    """
    Generate actionable insights from business metrics data.

    Args:
        metrics: Dictionary of metric categories, each containing metric names and values,
                 e.g., {"engagement": {"likes": 150, "shares": 30}, "revenue": {"mrr": 5000}}.

    Returns:
        List of insight dictionaries, each with insight (str), category (str),
        impact (str), priority (str), and suggested_action (str).
    """
    if not metrics:
        return []

    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a business intelligence expert. Analyze the provided metrics and "
                    "generate actionable insights. Return a JSON object with:\n"
                    '- "insights": list of objects, each with:\n'
                    '  - "insight": clear description of the finding\n'
                    '  - "category": area (e.g., "engagement", "revenue", "growth")\n'
                    '  - "impact": "low", "medium", or "high"\n'
                    '  - "priority": "low", "medium", "high", or "critical"\n'
                    '  - "suggested_action": specific action to take\n'
                    '  - "metric_reference": which metrics support this insight\n'
                    "\nFocus on anomalies, trends, opportunities, and risks. "
                    "Prioritize actionable insights over observations. Generate 3-7 insights."
                ),
            },
            {
                "role": "user",
                "content": f"Generate insights from these metrics:\n{json.dumps(metrics, default=str)}",
            },
        ]

        result = await _call_groq(messages, max_tokens=2000)

        insights = result.get("insights", [])

        # Validate and normalize each insight
        validated = []
        for item in insights:
            if isinstance(item, dict) and "insight" in item:
                validated.append({
                    "insight": item.get("insight", ""),
                    "category": item.get("category", "general"),
                    "impact": item.get("impact", "medium"),
                    "priority": item.get("priority", "medium"),
                    "suggested_action": item.get("suggested_action", ""),
                    "metric_reference": item.get("metric_reference", ""),
                })

        return validated

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error generating insights: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error generating insights: %s", str(e))
        raise


async def recommend_strategy(goals: dict, performance: dict) -> dict:
    """
    Generate strategic recommendations based on business goals and current performance.

    Args:
        goals: Dictionary of business goals with targets, timelines, and priorities.
        performance: Dictionary of current performance metrics and trends.

    Returns:
        Dictionary with recommendations (list), overall_assessment (str),
        priority_actions (list), resource_allocation (dict), and timeline (dict).
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a strategic marketing advisor. Based on the business goals and "
                    "current performance, provide strategic recommendations. "
                    "Return a JSON object with:\n"
                    '- "overall_assessment": brief assessment of current trajectory\n'
                    '- "goal_alignment": how well current performance aligns with goals (0-100)\n'
                    '- "recommendations": list of objects with {"recommendation": description, '
                    '"rationale": why, "expected_impact": "low"/"medium"/"high", '
                    '"effort": "low"/"medium"/"high", "timeline": timeframe}\n'
                    '- "priority_actions": top 3 actions to take immediately\n'
                    '- "resource_allocation": {"focus_areas": list, "deprioritize": list}\n'
                    '- "risks": potential risks to achieving goals\n'
                    '- "quick_wins": actions that can show results within 2 weeks\n'
                    "\nBe specific, practical, and prioritize high-impact, low-effort actions."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Business goals:\n{json.dumps(goals, default=str)}\n\n"
                    f"Current performance:\n{json.dumps(performance, default=str)}"
                ),
            },
        ]

        result = await _call_groq(messages, max_tokens=2000)

        return {
            "overall_assessment": result.get("overall_assessment", ""),
            "goal_alignment": max(0, min(100, int(result.get("goal_alignment", 50)))),
            "recommendations": result.get("recommendations", []),
            "priority_actions": result.get("priority_actions", []),
            "resource_allocation": result.get("resource_allocation", {}),
            "risks": result.get("risks", []),
            "quick_wins": result.get("quick_wins", []),
            "recommended_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error recommending strategy: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error recommending strategy: %s", str(e))
        raise
