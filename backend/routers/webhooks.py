from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database import AsyncDB

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


# --- Request / Response Models ---

class ContactFormSubmission(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    message: str
    source: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class WebhookRegister(BaseModel):
    name: str
    url: str
    events: List[str]
    secret: Optional[str] = None
    enabled: bool = True


# --- Endpoints ---

@router.post("/n8n/{event_type}")
async def receive_n8n_webhook(event_type: str, request: Request):
    """Receive webhook events from n8n automation workflows."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    try:
        body = await request.json()
    except Exception:
        body = {}

    event_row = {
        "source": "n8n",
        "event_type": event_type,
        "payload": body,
        "status": "received",
    }
    result = await db.table("webhook_events").insert(event_row).execute()

    try:
        from services import automation_service
        await automation_service.process_webhook_event(event_type, body)
    except ImportError:
        pass
    except Exception as e:
        if result.data:
            await db.table("webhook_events").update({
                "status": "error",
                "error": str(e),
            }).eq("id", result.data[0]["id"]).execute()

    return {"status": "received", "event_type": event_type}


@router.post("/contact-form")
async def receive_contact_form(data: ContactFormSubmission):
    """Receive and process contact form submissions."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    event_row = {
        "source": "contact_form",
        "event_type": "form_submission",
        "payload": data.model_dump(),
        "status": "received",
    }
    await db.table("webhook_events").insert(event_row).execute()

    try:
        customer_row = {
            "name": data.name,
            "email": data.email,
            "phone": data.phone,
            "source": data.source or "contact_form",
            "stage": "lead",
            "score": 10,
            "metadata": data.metadata or {},
        }
        await db.table("customers").insert(customer_row).execute()
    except Exception:
        pass

    try:
        conversation_row = {
            "channel": "contact_form",
            "customer_email": data.email,
            "customer_name": data.name,
            "status": "new",
        }
        conv_result = await db.table("conversations").insert(conversation_row).execute()

        if conv_result.data:
            message_row = {
                "conversation_id": conv_result.data[0]["id"],
                "channel": "contact_form",
                "direction": "inbound",
                "message": data.message,
                "status": "received",
            }
            await db.table("messages").insert(message_row).execute()
    except Exception:
        pass

    return {"status": "received", "message": "Contact form submission processed"}


@router.get("/registry")
async def list_webhooks():
    """List all registered webhooks."""
    try:
        db = AsyncDB()
    except ValueError:
        return []

    result = await db.table("webhook_registry").select("*").order("created_at", desc=True).execute()
    return result.data or []


@router.post("/registry")
async def register_webhook(data: WebhookRegister):
    """Register a new webhook endpoint."""
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    row = {
        "name": data.name,
        "url": data.url,
        "events": data.events,
        "secret": data.secret,
        "enabled": data.enabled,
    }
    result = await db.table("webhook_registry").insert(row).execute()
    return result.data[0] if result.data else row
