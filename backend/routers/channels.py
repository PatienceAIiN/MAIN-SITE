from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database import AsyncDB

router = APIRouter(prefix="/api/channels", tags=["channels"])


class SendMessageRequest(BaseModel):
    channel: str
    message: str
    recipient: str
    metadata: Optional[Dict[str, Any]] = None


class ReplyRequest(BaseModel):
    message: str
    use_ai: bool = True


class InstagramPublishRequest(BaseModel):
    caption: str
    image_url: Optional[str] = None
    hashtags: Optional[List[str]] = None


class RedditMonitorRequest(BaseModel):
    subreddit: str
    keywords: Optional[List[str]] = None
    auto_respond: bool = False


class LinkedInPublishRequest(BaseModel):
    content: str
    media_url: Optional[str] = None
    visibility: str = "public"


@router.post("/send")
async def send_message(data: SendMessageRequest):
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    try:
        from services import channel_service
        result = await channel_service.send_message(
            channel=data.channel,
            message=data.message,
            recipient=data.recipient,
            metadata=data.metadata,
        )
        return result
    except ImportError:
        row = {
            "channel": data.channel,
            "direction": "outbound",
            "message": data.message,
            "recipient": data.recipient,
            "metadata": data.metadata or {},
            "status": "queued",
        }
        result = await db.table("messages").insert(row).execute()
        return result.data[0] if result.data else row


@router.get("/inbox")
async def get_inbox(
    channel: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    try:
        db = AsyncDB()
    except ValueError:
        return []

    query = db.table("conversations").select("*").order("updated_at", desc=True).limit(limit).offset(offset)
    if channel:
        query = query.eq("channel", channel)
    if status:
        query = query.eq("status", status)
    result = await query.execute()
    return result.data or []


@router.get("/inbox/{conversation_id}")
async def get_conversation(conversation_id: int):
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    conversation = await db.table("conversations").select("*").eq("id", conversation_id).single().execute()
    if not conversation.data:
        raise HTTPException(404, "Conversation not found")

    messages = await db.table("messages").select("*").eq("conversation_id", conversation_id).order("created_at", desc=False).execute()

    return {
        "conversation": conversation.data,
        "messages": messages.data or [],
    }


@router.post("/inbox/{conversation_id}/reply")
async def reply_to_conversation(conversation_id: int, data: ReplyRequest):
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    conversation = await db.table("conversations").select("*").eq("id", conversation_id).single().execute()
    if not conversation.data:
        raise HTTPException(404, "Conversation not found")

    reply_text = data.message
    if data.use_ai:
        try:
            from services import groq_service
            msgs = await db.table("messages").select("*").eq("conversation_id", conversation_id).order("created_at", desc=False).execute()
            context = msgs.data or []
            ai_reply = await groq_service.generate_reply(context, data.message)
            reply_text = ai_reply.get("reply", data.message)
        except (ImportError, Exception):
            pass

    row = {
        "conversation_id": conversation_id,
        "channel": conversation.data.get("channel"),
        "direction": "outbound",
        "message": reply_text,
        "status": "sent",
    }
    result = await db.table("messages").insert(row).execute()
    await db.table("conversations").update({"status": "replied"}).eq("id", conversation_id).execute()

    return result.data[0] if result.data else row


@router.get("/status")
async def get_channel_status():
    try:
        db = AsyncDB()
    except ValueError:
        return []

    try:
        result = await db.table("channel_integrations").select("*").execute()
        return result.data or []
    except Exception:
        return [
            {"channel": "email", "connected": False},
            {"channel": "twitter", "connected": False},
            {"channel": "instagram", "connected": False},
            {"channel": "linkedin", "connected": False},
            {"channel": "reddit", "connected": False},
            {"channel": "whatsapp", "connected": False},
            {"channel": "sms", "connected": False},
        ]


@router.post("/instagram/publish")
async def publish_instagram(data: InstagramPublishRequest):
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    try:
        from services import channel_service
        result = await channel_service.publish_instagram(
            caption=data.caption,
            image_url=data.image_url,
            hashtags=data.hashtags,
        )
        return result
    except ImportError:
        row = {
            "channel": "instagram",
            "content": data.caption,
            "image_url": data.image_url,
            "hashtags": data.hashtags or [],
            "status": "queued",
        }
        result = await db.table("social_posts").insert(row).execute()
        return result.data[0] if result.data else row


@router.post("/reddit/monitor")
async def monitor_subreddit(data: RedditMonitorRequest):
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    try:
        from services import channel_service
        result = await channel_service.monitor_subreddit(
            subreddit=data.subreddit,
            keywords=data.keywords,
            auto_respond=data.auto_respond,
        )
        return result
    except ImportError:
        row = {
            "channel": "reddit",
            "subreddit": data.subreddit,
            "keywords": data.keywords or [],
            "auto_respond": data.auto_respond,
            "status": "active",
        }
        result = await db.table("monitors").insert(row).execute()
        return result.data[0] if result.data else row


@router.post("/linkedin/publish")
async def publish_linkedin(data: LinkedInPublishRequest):
    try:
        db = AsyncDB()
    except ValueError:
        raise HTTPException(503, "Database not configured")

    try:
        from services import channel_service
        result = await channel_service.publish_linkedin(
            content=data.content,
            media_url=data.media_url,
            visibility=data.visibility,
        )
        return result
    except ImportError:
        row = {
            "channel": "linkedin",
            "content": data.content,
            "media_url": data.media_url,
            "visibility": data.visibility,
            "status": "queued",
        }
        result = await db.table("social_posts").insert(row).execute()
        return result.data[0] if result.data else row
