import os
import json
from pathlib import Path
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

load_dotenv()

from database import AsyncDB
from services import groq_service, together_service, twitter_service
from routers import (
    channels_router,
    crm_router,
    automation_router,
    knowledge_router,
    analytics_router,
    escalations_router,
    webhooks_router,
)

IMAGES_DIR = Path(__file__).parent.parent / "images"
IMAGES_DIR.mkdir(exist_ok=True)


scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")


async def _scheduler_job():
    """Run every hour — checks if current hour is in configured posting schedule."""
    try:
        db = AsyncDB()
        cfg_res = await db.table("config").select("*").execute()
        cfg = {r["key"]: r["value"] for r in (cfg_res.data or [])}

        if cfg.get("scheduler_enabled") != "true":
            return

        try:
            hours = json.loads(cfg.get("scheduler_times", "[9,13,18]"))
        except Exception:
            hours = [9, 13, 18]

        current_hour = datetime.now().hour
        if current_hour not in hours:
            return

        platforms = [p.strip() for p in cfg.get("scheduler_platforms", "twitter").split(",") if p.strip()]
        max_per_run = int(cfg.get("scheduler_max_per_run", "1"))
        brand_voice = cfg.get("brand_voice", "Professional and engaging")
        topics = ["AI governance", "enterprise productivity", "AI automation", "product-led growth"]

        print(f"[scheduler] Running at hour {current_hour} for platforms: {platforms}")

        for platform in platforms:
            # Find unposted content for platform
            q = db.table("content").select("*").eq("posted", False).eq("platform", platform).limit(max_per_run)
            result = await q.execute()
            items = result.data or []

            # Generate new content if none queued
            if not items:
                import random
                topic = random.choice(topics)
                content = await groq_service.generate_content(topic, platform, brand_voice)
                image_url = None
                if content.get("image_description"):
                    try:
                        image_url = await together_service.generate_image(content["image_description"])
                    except Exception as ie:
                        print(f"[scheduler] image gen failed: {ie}")
                row = {
                    "date": datetime.now().strftime("%Y-%m-%d"),
                    "platform": platform, "topic": topic,
                    "hook": content.get("hook", ""), "body": content.get("body", ""),
                    "cta": content.get("cta", ""), "image_url": image_url,
                    "image_description": content.get("image_description", ""), "posted": False,
                }
                ins = await db.table("content").insert(row).execute()
                items = ins.data or [row]

            for item in items[:max_per_run]:
                try:
                    if platform == "twitter":
                        tweet_text = "\n\n".join(filter(None, [
                            item.get("hook", ""), item.get("body", ""), item.get("cta", "")
                        ])).strip()[:280]
                        res = twitter_service.post_tweet(tweet_text, item.get("image_url"))
                        await db.table("content").update({
                            "posted": True, "post_id": res["tweet_id"], "post_url": res["tweet_url"]
                        }).eq("id", item["id"]).execute()
                        print(f"[scheduler] Posted to Twitter: {res['tweet_url']}")
                except Exception as pe:
                    print(f"[scheduler] Post failed for {platform}: {pe}")
    except Exception as e:
        print(f"[scheduler] Job error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from database import _async_init_db
    try:
        await _async_init_db()
    except Exception as e:
        print(f"DB init warning: {e}")

    # Start hourly scheduler
    scheduler.add_job(_scheduler_job, CronTrigger(minute=0), id="auto_post", replace_existing=True)
    scheduler.start()
    print("[scheduler] Started — checks every hour")
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="AI Growth Operating System — patienceai.in", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

app.include_router(channels_router)
app.include_router(crm_router)
app.include_router(automation_router)
app.include_router(knowledge_router)
app.include_router(analytics_router)
app.include_router(escalations_router)
app.include_router(webhooks_router)


# ── Pydantic models ─────────────────────────────────────────────────────────

class ContentCreate(BaseModel):
    date: str
    platform: str
    topic: Optional[str] = None
    hook: Optional[str] = None
    body: Optional[str] = None
    cta: Optional[str] = None
    image_url: Optional[str] = None
    image_description: Optional[str] = None


class ContentUpdate(BaseModel):
    date: Optional[str] = None
    platform: Optional[str] = None
    topic: Optional[str] = None
    hook: Optional[str] = None
    body: Optional[str] = None
    cta: Optional[str] = None
    image_url: Optional[str] = None
    image_description: Optional[str] = None


class GenerateRequest(BaseModel):
    topic: str
    platform: str = "twitter"
    date: Optional[str] = None


class ConfigUpdate(BaseModel):
    configs: dict


# ── Content endpoints (preserved) ───────────────────────────────────────────

@app.get("/api/content")
async def list_content(
    posted: Optional[bool] = Query(None),
    platform: Optional[str] = Query(None),
):
    try:
        db = AsyncDB()
    except ValueError:
        return []
    q = db.table("content").select("*").order("created_at", desc=True)
    if posted is not None:
        q = q.eq("posted", posted)
    if platform:
        q = q.eq("platform", platform)
    result = await q.execute()
    return result.data or []


@app.post("/api/content")
async def create_content(data: ContentCreate):
    db = AsyncDB()
    row = data.model_dump(exclude_none=True)
    row["posted"] = False
    result = await db.table("content").insert(row).execute()
    return result.data[0] if result.data else {}


@app.put("/api/content/{content_id}")
async def update_content(content_id: int, data: ContentUpdate):
    db = AsyncDB()
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    result = await db.table("content").update(updates).eq("id", content_id).execute()
    if not result.data:
        raise HTTPException(404, "Content not found")
    return result.data[0]


@app.delete("/api/content/{content_id}")
async def delete_content(content_id: int):
    db = AsyncDB()
    item = await db.table("content").select("*").eq("id", content_id).single().execute()
    if not item.data:
        raise HTTPException(404, "Content not found")
    record = item.data
    if record.get("post_id"):
        try:
            twitter_service.delete_tweet(record["post_id"])
        except Exception:
            pass
    if record.get("image_url"):
        img_path = IMAGES_DIR / Path(record["image_url"]).name
        if img_path.exists():
            img_path.unlink()
    await db.table("content").delete().eq("id", content_id).execute()
    return {"status": "deleted"}


@app.post("/api/content/generate")
async def generate_content(req: GenerateRequest):
    db = AsyncDB()
    config_res = await db.table("config").select("*").execute()
    config_map = {r["key"]: r["value"] for r in (config_res.data or [])}
    brand_voice = config_map.get("brand_voice", "Professional and engaging")

    content = await groq_service.generate_content(req.topic, req.platform, brand_voice)

    image_url = None
    image_desc = content.get("image_description", "")
    if image_desc:
        try:
            image_url = await together_service.generate_image(image_desc)
        except Exception as e:
            print(f"Image generation failed: {e}")

    row = {
        "date": req.date or datetime.now().strftime("%Y-%m-%d"),
        "platform": req.platform,
        "topic": req.topic,
        "hook": content.get("hook", ""),
        "body": content.get("body", ""),
        "cta": content.get("cta", ""),
        "image_url": image_url,
        "image_description": image_desc,
        "posted": False,
    }
    result = await db.table("content").insert(row).execute()
    return result.data[0] if result.data else row


@app.post("/api/content/{content_id}/post")
async def post_content(content_id: int):
    db = AsyncDB()
    item = await db.table("content").select("*").eq("id", content_id).single().execute()
    if not item.data:
        raise HTTPException(404, "Content not found")
    record = item.data
    if record.get("posted"):
        raise HTTPException(400, "Already posted")

    tweet_text = "\n\n".join(filter(None, [
        record.get("hook", ""), record.get("body", ""), record.get("cta", "")
    ])).strip()
    if len(tweet_text) > 280:
        tweet_text = tweet_text[:277] + "..."

    try:
        result = twitter_service.post_tweet(tweet_text, record.get("image_url"))
    except Exception as e:
        raise HTTPException(500, f"Twitter posting failed: {str(e)}")

    await db.table("content").update({
        "posted": True,
        "post_id": result["tweet_id"],
        "post_url": result["tweet_url"],
    }).eq("id", content_id).execute()

    updated = await db.table("content").select("*").eq("id", content_id).single().execute()
    return updated.data


@app.delete("/api/content/{content_id}/tweet")
async def delete_tweet(content_id: int):
    db = AsyncDB()
    item = await db.table("content").select("*").eq("id", content_id).single().execute()
    if not item.data:
        raise HTTPException(404, "Content not found")
    record = item.data
    if not record.get("post_id"):
        raise HTTPException(400, "No tweet to delete")
    try:
        twitter_service.delete_tweet(record["post_id"])
    except Exception as e:
        raise HTTPException(500, f"Failed to delete tweet: {str(e)}")
    await db.table("content").update({
        "posted": False, "post_id": None, "post_url": None,
    }).eq("id", content_id).execute()
    return {"status": "tweet deleted"}


# ── Config endpoints ─────────────────────────────────────────────────────────

ENV_KEY_MAP = {
    # Database
    "database_url": "DATABASE_URL",
    # AI
    "groq_api_key": "GROQ_API_KEY",
    "together_api_key": "TOGETHER_API_KEY",
    # X / Twitter
    "twitter_api_key": "TWITTER_API_KEY",
    "twitter_api_secret": "TWITTER_API_SECRET",
    "twitter_access_token": "TWITTER_ACCESS_TOKEN",
    "twitter_access_secret": "TWITTER_ACCESS_SECRET",
    "twitter_bearer_token": "TWITTER_BEARER_TOKEN",
    # LinkedIn
    "linkedin_client_id": "LINKEDIN_CLIENT_ID",
    "linkedin_client_secret": "LINKEDIN_CLIENT_SECRET",
    "linkedin_access_token": "LINKEDIN_ACCESS_TOKEN",
    "linkedin_page_id": "LINKEDIN_PAGE_ID",
    # Instagram
    "instagram_access_token": "INSTAGRAM_ACCESS_TOKEN",
    "instagram_account_id": "INSTAGRAM_ACCOUNT_ID",
    # LinkedIn
    "linkedin_org_urn": "LINKEDIN_ORG_URN",
    # Email / SMTP
    "smtp_host": "SMTP_HOST",
    "smtp_port": "SMTP_PORT",
    "smtp_user": "SMTP_USER",
    "smtp_pass": "SMTP_PASS",
    "smtp_sender_name": "SMTP_SENDER_NAME",
    "contact_to_email": "CONTACT_TO_EMAIL",
    # Image
    "image_style_prefix": "IMAGE_STYLE_PREFIX",
    # Scheduler
    "scheduler_enabled": "SCHEDULER_ENABLED",
    "scheduler_times": "SCHEDULER_TIMES",
    "scheduler_platforms": "SCHEDULER_PLATFORMS",
    "scheduler_max_per_run": "SCHEDULER_MAX_PER_RUN",
    # Other
    "reddit_client_id": "REDDIT_CLIENT_ID",
    "reddit_client_secret": "REDDIT_CLIENT_SECRET",
    "redis_url": "REDIS_URL",
    # Brand
    "brand_name": "BRAND_NAME",
    "brand_voice": "BRAND_VOICE",
    "target_audience": "TARGET_AUDIENCE",
}


@app.get("/api/config")
async def get_config():
    try:
        db = AsyncDB()
        result = await db.table("config").select("*").execute()
        stored = {r["key"]: r["value"] for r in (result.data or [])}
        # Merge with env vars (env wins for non-empty)
        for config_key, env_key in ENV_KEY_MAP.items():
            env_val = os.getenv(env_key, "")
            if env_val and config_key not in stored:
                stored[config_key] = env_val
        return stored
    except Exception:
        return {}


@app.post("/api/config")
async def update_config(data: ConfigUpdate):
    for key, value in data.configs.items():
        if key in ENV_KEY_MAP and value:
            os.environ[ENV_KEY_MAP[key]] = value

    try:
        db = AsyncDB()
        for key, value in data.configs.items():
            if not value:
                continue
            existing = await db.table("config").select("id").eq("key", key).execute()
            if existing.data:
                await db.table("config").update({"value": value}).eq("key", key).execute()
            else:
                await db.table("config").insert({"key": key, "value": value}).execute()
    except Exception as e:
        print(f"Config save warning: {e}")

    return {"status": "saved"}


# ── Scheduler status ──────────────────────────────────────────────────────────

@app.get("/api/scheduler")
async def get_scheduler_status():
    try:
        db = AsyncDB()
        res = await db.table("config").select("*").execute()
        cfg = {r["key"]: r["value"] for r in (res.data or [])}
        hours = []
        try:
            hours = json.loads(cfg.get("scheduler_times", "[9,13,18]"))
        except Exception:
            hours = [9, 13, 18]
        jobs = scheduler.get_jobs()
        return {
            "enabled": cfg.get("scheduler_enabled") == "true",
            "hours": hours,
            "platforms": cfg.get("scheduler_platforms", "twitter").split(","),
            "max_per_run": int(cfg.get("scheduler_max_per_run", "1")),
            "next_run": jobs[0].next_run_time.isoformat() if jobs else None,
        }
    except Exception as e:
        return {"enabled": False, "error": str(e)}


@app.post("/api/scheduler/trigger")
async def trigger_scheduler_now():
    await _scheduler_job()
    return {"status": "triggered"}


# ── Health endpoint ───────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    import httpx
    checks: dict = {
        "status": "ok",
        "database": False,
        "groq": False,
        "together": False,
        "twitter": False,
        "redis": False,
    }

    # Database
    try:
        db = AsyncDB()
        r = await db.table("config").select("id").limit(1).execute()
        checks["database"] = True
    except Exception:
        pass

    # Groq
    if os.getenv("GROQ_API_KEY"):
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}"},
                )
                checks["groq"] = r.status_code == 200
        except Exception:
            pass

    # Together
    if os.getenv("TOGETHER_API_KEY"):
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(
                    "https://api.together.xyz/v1/models",
                    headers={"Authorization": f"Bearer {os.getenv('TOGETHER_API_KEY')}"},
                )
                checks["together"] = r.status_code == 200
        except Exception:
            pass

    # Twitter
    if os.getenv("TWITTER_BEARER_TOKEN") and not os.getenv("TWITTER_BEARER_TOKEN", "").startswith("dummy"):
        try:
            client = twitter_service._get_client()
            me = client.get_me()
            checks["twitter"] = me.data is not None
        except Exception:
            pass

    # Redis
    if os.getenv("REDIS_URL"):
        try:
            import redis.asyncio as aioredis
            r = aioredis.from_url(os.getenv("REDIS_URL"), socket_timeout=3)
            await r.ping()
            checks["redis"] = True
            await r.aclose()
        except Exception:
            pass

    return checks


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
