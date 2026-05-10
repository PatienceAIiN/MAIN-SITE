from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database import AsyncDB

router = APIRouter(prefix="/api/escalations", tags=["escalations"])


# --- Request / Response Models ---

class EscalationCreate(BaseModel):
    title: str
    description: str
    urgency: str = "medium"  # low, medium, high, critical
    source: Optional[str] = None
    source_id: Optional[int] = None
    assigned_to: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class EscalationResolve(BaseModel):
    resolution: str
    notes: Optional[str] = None


# --- Endpoints ---

@router.get("")
async def list_escalations(
    status: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    """List all escalations with optional filters for status and urgency."""
    try:
        db = AsyncDB()
    except ValueError:
        return []

    query = db.table("escalations").select("*").order("created_at", desc=True).limit(limit).offset(offset)
    if status:
        query = query.eq("status", status)
    if urgency:
        query = query.eq("urgency", urgency)
    result = await query.execute()
    return result.data or []


@router.get("/{escalation_id}")
async def get_escalation(escalation_id: int):
    """Get full details for a specific escalation."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    escalation = await (
        db.table("escalations")
        .select("*")
        .eq("id", escalation_id)
        .single()
        .execute()
    )
    if not escalation.data:
        raise HTTPException(404, "Escalation not found")

    activity = await (
        db.table("escalation_activity")
        .select("*")
        .eq("escalation_id", escalation_id)
        .order("created_at", desc=False)
        .execute()
    )

    return {
        "escalation": escalation.data,
        "activity": activity.data or [],
    }


@router.post("/{escalation_id}/resolve")
async def resolve_escalation(escalation_id: int, data: EscalationResolve):
    """Resolve an escalation with a resolution summary."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    escalation = await (
        db.table("escalations")
        .select("*")
        .eq("id", escalation_id)
        .single()
        .execute()
    )
    if not escalation.data:
        raise HTTPException(404, "Escalation not found")
    if escalation.data.get("status") == "resolved":
        raise HTTPException(400, "Escalation is already resolved")

    result = await db.table("escalations").update({
        "status": "resolved",
        "resolution": data.resolution,
    }).eq("id", escalation_id).execute()

    try:
        await db.table("escalation_activity").insert({
            "escalation_id": escalation_id,
            "action": "resolved",
            "details": data.resolution,
            "notes": data.notes,
        }).execute()
    except Exception:
        pass

    if not result.data:
        raise HTTPException(404, "Escalation not found")
    return result.data[0]


@router.post("")
async def create_escalation(data: EscalationCreate):
    """Create a manual escalation."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    row = data.model_dump(exclude_none=True)
    row["status"] = "open"
    result = await db.table("escalations").insert(row).execute()

    try:
        escalation = result.data[0] if result.data else row
        await db.table("escalation_activity").insert({
            "escalation_id": escalation.get("id"),
            "action": "created",
            "details": f"Escalation created: {data.title}",
        }).execute()
    except Exception:
        pass

    return result.data[0] if result.data else row
