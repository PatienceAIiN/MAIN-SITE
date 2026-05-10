"""
Confidence Engine - AI-powered confidence scoring for automated actions,
escalation logic, and human-in-the-loop decision support.
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

# Actions that ALWAYS require human approval regardless of confidence score
ESCALATION_ACTIONS: list[str] = [
    "payments",
    "contracts",
    "pricing",
    "refunds",
    "legal",
]


def _groq_headers() -> dict:
    return {
        "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}",
        "Content-Type": "application/json",
    }


async def _call_groq(messages: list, temperature: float = 0.2, max_tokens: int = 1024) -> dict:
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


async def calculate_confidence(action: str, context: dict) -> dict:
    """
    Calculate a confidence score for a proposed automated action.

    Args:
        action: The action being considered (e.g., "send_email", "update_pricing").
        context: Dictionary with relevant context such as lead_data, history,
                 action_parameters, and risk_factors.

    Returns:
        Dictionary with confidence_score (0-1), can_auto_execute (bool),
        requires_human_review (bool), reasoning (str), and risk_assessment (str).
    """
    # Check if the action always requires human approval
    action_lower = action.lower()
    force_escalation = any(
        escalation_action in action_lower for escalation_action in ESCALATION_ACTIONS
    )

    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a decision confidence assessor for a marketing automation platform. "
                    "Evaluate the proposed action and determine if it can be auto-executed safely. "
                    "Return a JSON object with:\n"
                    '- "confidence_score": float 0.0-1.0 (how confident the action is correct)\n'
                    '- "can_auto_execute": boolean (safe to execute without human review)\n'
                    '- "requires_human_review": boolean (should a human review first)\n'
                    '- "reasoning": explanation of the confidence assessment\n'
                    '- "risk_assessment": "low", "medium", "high", or "critical"\n'
                    '- "risk_factors": list of specific risks\n'
                    '- "mitigations": what safeguards are in place\n'
                    "\nRules:\n"
                    "- Actions involving payments, contracts, pricing, refunds, or legal ALWAYS "
                    "require human review regardless of confidence.\n"
                    "- Auto-execute only if confidence >= 0.85 and risk is low.\n"
                    "- When in doubt, require human review."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Action: {action}\n"
                    f"Context:\n{json.dumps(context, default=str)}"
                ),
            },
        ]

        result = await _call_groq(messages)

        confidence_score = max(0.0, min(1.0, float(result.get("confidence_score", 0.5))))

        # Override auto-execution for escalation actions
        if force_escalation:
            can_auto_execute = False
            requires_human_review = True
        else:
            can_auto_execute = (
                bool(result.get("can_auto_execute", False))
                and confidence_score >= 0.85
                and result.get("risk_assessment", "high") == "low"
            )
            requires_human_review = not can_auto_execute

        return {
            "confidence_score": confidence_score,
            "can_auto_execute": can_auto_execute,
            "requires_human_review": requires_human_review,
            "reasoning": result.get("reasoning", ""),
            "risk_assessment": result.get("risk_assessment", "medium"),
            "risk_factors": result.get("risk_factors", []),
            "mitigations": result.get("mitigations", []),
            "forced_escalation": force_escalation,
            "calculated_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error calculating confidence: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error calculating confidence: %s", str(e))
        raise


async def should_escalate(action_type: str, confidence: float, context: dict) -> dict:
    """
    Determine whether an action should be escalated to a human decision-maker.

    Args:
        action_type: Category of the action (e.g., "email", "pricing_change", "contract").
        confidence: Current confidence score (0.0-1.0) from calculate_confidence.
        context: Dictionary with details about the action, customer, and situation.

    Returns:
        Dictionary with escalate (bool), reason (str), urgency (str),
        suggested_reviewer (str), and deadline (str).
    """
    # Immediate escalation for restricted actions
    action_lower = action_type.lower()
    if any(esc in action_lower for esc in ESCALATION_ACTIONS):
        return {
            "escalate": True,
            "reason": f"Action type '{action_type}' is in the mandatory escalation list and always requires human approval.",
            "urgency": "high",
            "suggested_reviewer": "manager",
            "deadline": "before_execution",
            "escalated_at": datetime.utcnow().isoformat(),
        }

    # Low confidence threshold
    if confidence < 0.5:
        return {
            "escalate": True,
            "reason": f"Confidence score ({confidence:.2f}) is below the minimum threshold (0.50).",
            "urgency": "high",
            "suggested_reviewer": "team_lead",
            "deadline": "within_1_hour",
            "escalated_at": datetime.utcnow().isoformat(),
        }

    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a risk management expert for a marketing automation platform. "
                    "Determine if the proposed action should be escalated to a human. "
                    "Return a JSON object with:\n"
                    '- "escalate": boolean\n'
                    '- "reason": why or why not to escalate\n'
                    '- "urgency": "low", "medium", "high", or "critical"\n'
                    '- "suggested_reviewer": role that should review (e.g., "manager", '
                    '"legal", "team_lead", "none")\n'
                    '- "deadline": when the review should happen\n'
                    '- "alternative_actions": safer actions that could be auto-executed\n'
                    "\nEscalate if: high financial impact, reputational risk, legal implications, "
                    "affects many customers, or is irreversible."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Action type: {action_type}\n"
                    f"Confidence: {confidence}\n"
                    f"Context:\n{json.dumps(context, default=str)}"
                ),
            },
        ]

        result = await _call_groq(messages)

        return {
            "escalate": bool(result.get("escalate", True)),
            "reason": result.get("reason", ""),
            "urgency": result.get("urgency", "medium"),
            "suggested_reviewer": result.get("suggested_reviewer", "manager"),
            "deadline": result.get("deadline", ""),
            "alternative_actions": result.get("alternative_actions", []),
            "escalated_at": datetime.utcnow().isoformat(),
        }

    except httpx.HTTPStatusError as e:
        logger.error("Groq API error in escalation check: %s", e.response.text)
        raise
    except Exception as e:
        logger.error("Error checking escalation: %s", str(e))
        raise
