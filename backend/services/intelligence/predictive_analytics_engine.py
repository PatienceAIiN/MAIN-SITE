"""
Predictive Analytics Engine - AI-powered engagement prediction, churn risk assessment,
and growth forecasting.
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


async def predict_engagement(content: dict) -> dict:
    """
    Predict engagement metrics for a piece of content before publishing.

    Args:
        content: Dictionary with type, text, platform, audience, hashtags,
                 media_type, and posting_time.

    Returns:
        Dictionary with predicted_likes, predicted_shares, predicted_comments,
        best_time (str), engagement_rate (float), and recommendations (list).
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a social media analytics expert. Predict the engagement a piece "
                    "of content will receive based on its attributes. Return a JSON object with:\n"
                    '- "predicted_likes": integer estimate\n'
                    '- "predicted_shares": integer estimate\n'
                    '- "predicted_comments": integer estimate\n'
                    '- "predicted_engagement_rate": float 0.0-1.0\n'
                    '- "best_time": ISO time string for optimal posting\n'
                    '- "best_day": day of week for optimal posting\n'
                    '- "confidence": float 0.0-1.0\n'
                    '- "recommendations": list of suggestions to improve engagement\n'
                    '- "predicted_reach": estimated reach multiplier (1.0 = baseline)\n'
                    '- "viral_potential": "low", "medium", or "high"\n'
                    "\nBase predictions on content quality, platform norms, "
                    "timing, and audience targeting."
                ),
            },
            {
                "role": "user",
                "content": f"Predict engagement for this content:\n{json.dumps(content, default=str)}",
            },
        ]

        result = await _call_groq(messages)

        return {
            "predicted_likes": max(0, int(result.get("predicted_likes", 0))),
            "predicted_shares": max(0, int(result.get("predicted_shares", 0))),
            "predicted_comments": max(0, int(result.get("predicted_comments", 0))),
            "predicted_engagement_rate": max(0.0, min(1.0, float(result.get("predicted_engagement_rate", 0.0)))),
            "best_time": result.get("best_time", ""),
            "best_day": result.get("best_day", ""),
            "confidence": max(0.0, min(1.0, float(result.get("confidence", 0.5)))),
            "recommendations": result.get("recommendations", []),
            "predicted_reach": float(result.get("predicted_reach", 1.0)),
            "viral_potential": result.get("viral_potential", "low"),
            "predicted_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error predicting engagement: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error predicting engagement: %s", str(e))
        raise


async def predict_churn_risk(customer_data: dict) -> dict:
    """
    Predict the risk of a customer churning based on their behavior and attributes.

    Args:
        customer_data: Dictionary with usage_metrics, billing_history, support_tickets,
                       engagement_data, account_age, plan_type, and last_activity.

    Returns:
        Dictionary with risk_score (0-100), risk_level (str), factors (list),
        recommended_actions (list), and time_window (str).
    """
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a customer retention analytics expert. Predict the churn risk "
                    "for the given customer. Return a JSON object with:\n"
                    '- "risk_score": integer 0-100 (100 = definitely churning)\n'
                    '- "risk_level": "low", "medium", "high", or "critical"\n'
                    '- "factors": list of objects with {"factor": description, '
                    '"impact": "low"/"medium"/"high", "direction": "positive"/"negative"}\n'
                    '- "recommended_actions": list of specific retention actions to take\n'
                    '- "time_window": estimated time before churn (e.g., "30_days", "90_days")\n'
                    '- "save_probability": float 0.0-1.0 (chance of saving the customer)\n'
                    '- "priority": "low", "medium", "high", or "urgent"\n'
                    "\nConsider: usage decline, support issues, billing problems, "
                    "engagement drops, competitor signals."
                ),
            },
            {
                "role": "user",
                "content": f"Predict churn risk for this customer:\n{json.dumps(customer_data, default=str)}",
            },
        ]

        result = await _call_groq(messages, max_tokens=1500)

        return {
            "risk_score": max(0, min(100, int(result.get("risk_score", 50)))),
            "risk_level": result.get("risk_level", "medium"),
            "factors": result.get("factors", []),
            "recommended_actions": result.get("recommended_actions", []),
            "time_window": result.get("time_window", "unknown"),
            "save_probability": max(0.0, min(1.0, float(result.get("save_probability", 0.5)))),
            "priority": result.get("priority", "medium"),
            "predicted_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error predicting churn: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error predicting churn risk: %s", str(e))
        raise


async def forecast_growth(historical_data: list) -> dict:
    """
    Forecast growth metrics based on historical data points.

    Args:
        historical_data: List of data point dictionaries with date, metric_name,
                         value, and optional context.

    Returns:
        Dictionary with projected_metrics (list), confidence_intervals (dict),
        trend (str), growth_rate (float), and assumptions (list).
    """
    if not historical_data:
        return {
            "projected_metrics": [],
            "confidence_intervals": {},
            "trend": "unknown",
            "growth_rate": 0.0,
            "assumptions": ["No historical data provided"],
            "forecasted_at": datetime.utcnow().isoformat(),
        }

    try:
        data_sample = historical_data[:60] if len(historical_data) > 60 else historical_data

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a growth analytics expert. Forecast future metrics based on "
                    "historical data. Return a JSON object with:\n"
                    '- "projected_metrics": list of {"date": "YYYY-MM-DD", "metric": name, '
                    '"value": projected_value} for next 30/60/90 days\n'
                    '- "confidence_intervals": {"low": multiplier, "high": multiplier} '
                    "(e.g., 0.8 and 1.2 for 80%-120% range)\n"
                    '- "trend": "accelerating", "steady_growth", "plateau", "declining"\n'
                    '- "growth_rate": monthly growth rate as float (e.g., 0.15 for 15%)\n'
                    '- "seasonality": any seasonal patterns detected\n'
                    '- "assumptions": list of assumptions made in the forecast\n'
                    '- "risks": factors that could affect the forecast\n'
                    '- "opportunities": potential upside factors\n'
                    "\nProvide realistic projections with appropriate uncertainty ranges."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Forecast growth from this historical data ({len(historical_data)} points):\n"
                    f"{json.dumps(data_sample, default=str)}"
                ),
            },
        ]

        result = await _call_groq(messages, max_tokens=2000)

        return {
            "projected_metrics": result.get("projected_metrics", []),
            "confidence_intervals": result.get("confidence_intervals", {"low": 0.8, "high": 1.2}),
            "trend": result.get("trend", "unknown"),
            "growth_rate": float(result.get("growth_rate", 0.0)),
            "seasonality": result.get("seasonality", "none detected"),
            "assumptions": result.get("assumptions", []),
            "risks": result.get("risks", []),
            "opportunities": result.get("opportunities", []),
            "data_points_analyzed": len(historical_data),
            "forecasted_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error forecasting growth: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error forecasting growth: %s", str(e))
        raise
