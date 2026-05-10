import os
import json
import httpx
from typing import Any

INSTAGRAM_GRAPH_URL = "https://graph.facebook.com/v19.0"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


async def _groq_chat(system: str, prompt: str, temperature: float = 0.7, max_tokens: int = 500) -> dict:
    """Internal helper – calls Groq chat completions and returns parsed JSON."""
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return json.loads(data["choices"][0]["message"]["content"])


async def publish_post(caption: str, image_url: str, access_token: str) -> dict[str, Any]:
    """Publish a photo post to Instagram via the Graph API (two-step container flow).

    1. Create a media container with the image URL and caption.
    2. Publish the container.

    Returns dict with media_id and status.
    """
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            # Step 1 – get the IG user id
            me_resp = await client.get(
                f"{INSTAGRAM_GRAPH_URL}/me",
                params={"fields": "id", "access_token": access_token},
            )
            me_resp.raise_for_status()
            ig_user_id = me_resp.json()["id"]

            # Step 2 – create container
            container_resp = await client.post(
                f"{INSTAGRAM_GRAPH_URL}/{ig_user_id}/media",
                params={
                    "image_url": image_url,
                    "caption": caption,
                    "access_token": access_token,
                },
            )
            container_resp.raise_for_status()
            container_id = container_resp.json()["id"]

            # Step 3 – publish
            publish_resp = await client.post(
                f"{INSTAGRAM_GRAPH_URL}/{ig_user_id}/media_publish",
                params={
                    "creation_id": container_id,
                    "access_token": access_token,
                },
            )
            publish_resp.raise_for_status()
            media_id = publish_resp.json()["id"]

            return {"media_id": media_id, "status": "published"}
    except httpx.HTTPStatusError as exc:
        return {"error": f"Instagram API error: {exc.response.status_code} – {exc.response.text}"}
    except Exception as exc:
        return {"error": f"Failed to publish post: {exc}"}


async def publish_story(image_url: str, access_token: str) -> dict[str, Any]:
    """Publish an image story to Instagram via the Graph API."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            me_resp = await client.get(
                f"{INSTAGRAM_GRAPH_URL}/me",
                params={"fields": "id", "access_token": access_token},
            )
            me_resp.raise_for_status()
            ig_user_id = me_resp.json()["id"]

            container_resp = await client.post(
                f"{INSTAGRAM_GRAPH_URL}/{ig_user_id}/media",
                params={
                    "image_url": image_url,
                    "media_type": "STORIES",
                    "access_token": access_token,
                },
            )
            container_resp.raise_for_status()
            container_id = container_resp.json()["id"]

            publish_resp = await client.post(
                f"{INSTAGRAM_GRAPH_URL}/{ig_user_id}/media_publish",
                params={
                    "creation_id": container_id,
                    "access_token": access_token,
                },
            )
            publish_resp.raise_for_status()
            story_id = publish_resp.json()["id"]

            return {"story_id": story_id, "status": "published"}
    except httpx.HTTPStatusError as exc:
        return {"error": f"Instagram API error: {exc.response.status_code} – {exc.response.text}"}
    except Exception as exc:
        return {"error": f"Failed to publish story: {exc}"}


async def get_messages(access_token: str) -> dict[str, Any]:
    """Fetch Instagram Direct Messages via the Graph API conversations endpoint."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            me_resp = await client.get(
                f"{INSTAGRAM_GRAPH_URL}/me",
                params={"fields": "id", "access_token": access_token},
            )
            me_resp.raise_for_status()
            ig_user_id = me_resp.json()["id"]

            conv_resp = await client.get(
                f"{INSTAGRAM_GRAPH_URL}/{ig_user_id}/conversations",
                params={
                    "platform": "instagram",
                    "fields": "participants,messages{message,from,created_time}",
                    "access_token": access_token,
                },
            )
            conv_resp.raise_for_status()
            conversations = conv_resp.json().get("data", [])

            return {"conversations": conversations, "count": len(conversations)}
    except httpx.HTTPStatusError as exc:
        return {"error": f"Instagram API error: {exc.response.status_code} – {exc.response.text}"}
    except Exception as exc:
        return {"error": f"Failed to fetch messages: {exc}"}


async def reply_message(message_id: str, text: str, access_token: str) -> dict[str, Any]:
    """Reply to an Instagram DM by message ID."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            me_resp = await client.get(
                f"{INSTAGRAM_GRAPH_URL}/me",
                params={"fields": "id", "access_token": access_token},
            )
            me_resp.raise_for_status()
            ig_user_id = me_resp.json()["id"]

            resp = await client.post(
                f"{INSTAGRAM_GRAPH_URL}/{ig_user_id}/messages",
                params={"access_token": access_token},
                json={
                    "recipient": {"comment_id": message_id},
                    "message": {"text": text},
                },
            )
            resp.raise_for_status()
            return {"status": "sent", "response": resp.json()}
    except httpx.HTTPStatusError as exc:
        return {"error": f"Instagram API error: {exc.response.status_code} – {exc.response.text}"}
    except Exception as exc:
        return {"error": f"Failed to reply: {exc}"}


async def generate_hashtags(topic: str, count: int = 10) -> dict[str, Any]:
    """Use Groq AI to generate relevant Instagram hashtags for a given topic."""
    try:
        prompt = (
            f"Generate {count} relevant Instagram hashtags for the topic: {topic}\n\n"
            "Return ONLY valid JSON with:\n"
            "- hashtags: list of strings (each starting with #)\n"
            "- reasoning: one sentence explaining the selection strategy"
        )
        result = await _groq_chat(
            system="You are a social media marketing expert. Return only valid JSON.",
            prompt=prompt,
            temperature=0.7,
            max_tokens=300,
        )
        return {"hashtags": result.get("hashtags", []), "reasoning": result.get("reasoning", "")}
    except Exception as exc:
        return {"error": f"Failed to generate hashtags: {exc}"}
