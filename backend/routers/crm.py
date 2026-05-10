from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database import AsyncDB

router = APIRouter(prefix="/api/crm", tags=["crm"])


class CustomerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    lead_stage: str = "new"
    lead_score: int = 0
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    lead_stage: Optional[str] = None
    lead_score: Optional[int] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class DealCreate(BaseModel):
    customer_id: Optional[int] = None
    stage: str = "lead"
    deal_value: float = 0.0
    probability: float = 0
    notes: Optional[str] = None
    next_action: Optional[str] = None


@router.get("/customers")
async def list_customers(
    stage: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
):
    db = AsyncDB()
    q = db.table("customers").select("*").order("created_at", desc=True).limit(limit)
    if stage:
        q = q.eq("lead_stage", stage)
    if search:
        q = q.ilike("name", f"%{search}%")
    result = await q.execute()
    return result.data or []


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: int):
    db = AsyncDB()
    c = await db.table("customers").select("*").eq("id", customer_id).single().execute()
    if not c.data:
        raise HTTPException(404, "Customer not found")
    convos = await db.table("conversations").select("*").eq("customer_id", customer_id).order("created_at", desc=True).limit(20).execute()
    deals = await db.table("pipeline").select("*").eq("customer_id", customer_id).execute()
    return {"customer": c.data, "conversations": convos.data or [], "deals": deals.data or []}


@router.post("/customers")
async def create_customer(data: CustomerCreate):
    db = AsyncDB()
    row = data.model_dump(exclude_none=True)
    result = await db.table("customers").insert(row).execute()
    return result.data[0] if result.data else row


@router.put("/customers/{customer_id}")
async def update_customer(customer_id: int, data: CustomerUpdate):
    db = AsyncDB()
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    result = await db.table("customers").update(updates).eq("id", customer_id).execute()
    if not result.data:
        raise HTTPException(404, "Customer not found")
    return result.data[0]


@router.get("/pipeline")
async def get_pipeline():
    db = AsyncDB()
    deals = await db.table("pipeline").select("*").order("created_at", desc=True).execute()
    all_deals = deals.data or []
    stages: dict = {}
    total_value = 0.0
    for d in all_deals:
        s = d.get("stage", "lead")
        stages.setdefault(s, {"count": 0, "value": 0.0, "deals": []})
        v = float(d.get("deal_value", 0))
        stages[s]["count"] += 1
        stages[s]["value"] += v
        stages[s]["deals"].append(d)
        total_value += v
    customers = await db.table("customers").select("id,name,email,lead_stage,lead_score").execute()
    return {
        "stages": stages,
        "total_value": total_value,
        "total_deals": len(all_deals),
        "customers": customers.data or [],
    }


@router.post("/pipeline")
async def create_deal(data: DealCreate):
    db = AsyncDB()
    row = data.model_dump(exclude_none=True)
    result = await db.table("pipeline").insert(row).execute()
    return result.data[0] if result.data else row


@router.put("/pipeline/{deal_id}/stage")
async def update_deal_stage(deal_id: int, stage: str = Query(...)):
    db = AsyncDB()
    result = await db.table("pipeline").update({"stage": stage, "updated_at": "NOW()"}).eq("id", deal_id).execute()
    if not result.data:
        raise HTTPException(404, "Deal not found")
    return result.data[0]


@router.get("/pipeline/{deal_id}")
async def get_deal(deal_id: int):
    db = AsyncDB()
    d = await db.table("pipeline").select("*").eq("id", deal_id).single().execute()
    if not d.data:
        raise HTTPException(404, "Deal not found")
    return d.data
