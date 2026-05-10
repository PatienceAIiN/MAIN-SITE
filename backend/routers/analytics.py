from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database import AsyncDB

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# --- Request / Response Models ---

class AnalyticsQuestion(BaseModel):
    question: str
    time_range: Optional[str] = None  # e.g. "7d", "30d", "90d"


class DashboardMetrics(BaseModel):
    content_stats: Dict[str, Any]
    channel_stats: Dict[str, Any]
    lead_stats: Dict[str, Any]
    engagement_trends: List[Dict[str, Any]]


# --- Endpoints ---

@router.post("/ask")
async def ask_analytics(data: AnalyticsQuestion):
    """Ask an analytics question in natural language and get data-driven answers."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    try:
        from services import groq_service

        content = await db.table("content").select("*").execute()
        customers = await db.table("customers").select("*").execute()
        deals = await db.table("deals").select("*").execute()

        context_data = {
            "content_count": len(content.data or []),
            "customer_count": len(customers.data or []),
            "deal_count": len(deals.data or []),
            "content_sample": (content.data or [])[:10],
            "customer_sample": (customers.data or [])[:10],
            "deal_sample": (deals.data or [])[:10],
        }

        answer = await groq_service.answer_analytics_question(
            question=data.question,
            context=context_data,
            time_range=data.time_range,
        )
        return answer
    except ImportError:
        return {
            "answer": "Analytics AI service not configured. Please set up the Groq API key.",
            "data": {},
            "visualization": None,
        }
    except Exception as e:
        raise HTTPException(500, f"Analytics query failed: {str(e)}")


@router.get("/dashboard")
async def get_dashboard(time_range: Optional[str] = Query("30d")):
    """Get dashboard metrics including content stats, channel stats, lead stats, and engagement trends."""
    try:
        db = AsyncDB()
    except ValueError:
        return {
            "content_stats": {},
            "channel_stats": {},
            "lead_stats": {},
            "engagement_trends": [],
        }

    content = await db.table("content").select("*").execute()
    all_content = content.data or []

    content_stats = {
        "total": len(all_content),
        "posted": len([c for c in all_content if c.get("posted")]),
        "draft": len([c for c in all_content if not c.get("posted")]),
        "by_platform": {},
    }
    for item in all_content:
        platform = item.get("platform", "unknown")
        content_stats["by_platform"][platform] = content_stats["by_platform"].get(platform, 0) + 1

    channel_stats: Dict[str, Any] = {}
    try:
        messages = await db.table("messages").select("*").execute()
        for msg in (messages.data or []):
            ch = msg.get("channel", "unknown")
            if ch not in channel_stats:
                channel_stats[ch] = {"sent": 0, "received": 0}
            direction = msg.get("direction", "outbound")
            if direction == "outbound":
                channel_stats[ch]["sent"] += 1
            else:
                channel_stats[ch]["received"] += 1
    except Exception:
        pass

    lead_stats: Dict[str, Any] = {"total": 0, "by_stage": {}}
    try:
        customers = await db.table("customers").select("*").execute()
        all_customers = customers.data or []
        lead_stats["total"] = len(all_customers)
        for cust in all_customers:
            stage = cust.get("stage", "unknown")
            lead_stats["by_stage"][stage] = lead_stats["by_stage"].get(stage, 0) + 1
    except Exception:
        pass

    engagement_trends: List[Dict[str, Any]] = []
    try:
        for item in all_content:
            if item.get("posted") and item.get("created_at"):
                engagement_trends.append({
                    "date": item.get("date") or item.get("created_at", "")[:10],
                    "platform": item.get("platform"),
                    "type": "post",
                })
    except Exception:
        pass

    return {
        "content_stats": content_stats,
        "channel_stats": channel_stats,
        "lead_stats": lead_stats,
        "engagement_trends": engagement_trends,
    }


@router.get("/insights")
async def get_insights():
    """Get AI-generated insights based on current data."""
    try:
        db = AsyncDB()
    except ValueError:
        return {"insights": [], "generated_at": None}

    try:
        cached = await (
            db.table("analytics_insights")
            .select("*")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if cached.data:
            return cached.data[0]
    except Exception:
        pass

    try:
        from services import groq_service

        content = await db.table("content").select("*").execute()
        customers = await db.table("customers").select("*").execute()
        deals = await db.table("deals").select("*").execute()

        context = {
            "content": content.data or [],
            "customers": customers.data or [],
            "deals": deals.data or [],
        }

        insights = await groq_service.generate_insights(context)
        try:
            await db.table("analytics_insights").insert(insights).execute()
        except Exception:
            pass
        return insights
    except ImportError:
        return {
            "insights": ["Configure Groq API key to enable AI-generated insights."],
            "generated_at": None,
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to generate insights: {str(e)}")


@router.get("/predictions")
async def get_predictions(period: Optional[str] = Query("next_week")):
    """Get AI predictions for the next period (engagement, leads, revenue)."""
    try:
        db = AsyncDB()
    except ValueError:
        return {"predictions": [], "period": period, "confidence": 0.0}

    try:
        from services import groq_service

        content = await db.table("content").select("*").execute()
        customers = await db.table("customers").select("*").execute()
        deals = await db.table("deals").select("*").execute()

        context = {
            "content": content.data or [],
            "customers": customers.data or [],
            "deals": deals.data or [],
        }

        predictions = await groq_service.generate_predictions(context, period)
        return predictions
    except ImportError:
        return {
            "predictions": [],
            "period": period,
            "confidence": 0.0,
            "message": "Configure Groq API key to enable predictions.",
        }
    except Exception as e:
        raise HTTPException(500, f"Prediction generation failed: {str(e)}")
