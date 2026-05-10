import os
import json
import httpx
from typing import Any

LINKEDIN_API_URL = "https://api.linkedin.com/v2"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


async def _groq_chat(system: str, prompt: str, temperature: float = 0.7, max_tokens: int = 600) -> dict:
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


def _auth_headers(access_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
    }


async def get_profile(access_token: str) -> dict[str, Any]:
    """Fetch the authenticated user's LinkedIn profile."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{LINKEDIN_API_URL}/me",
                headers=_auth_headers(access_token),
                params={"projection": "(id,firstName,lastName,profilePicture(displayImage~:playableStreams))"},
            )
            resp.raise_for_status()
            profile = resp.json()

            first = profile.get("firstName", {}).get("localized", {})
            last = profile.get("lastName", {}).get("localized", {})
            first_name = next(iter(first.values()), "") if first else ""
            last_name = next(iter(last.values()), "") if last else ""

            return {
                "id": profile.get("id"),
                "first_name": first_name,
                "last_name": last_name,
                "full_name": f"{first_name} {last_name}".strip(),
            }
    except httpx.HTTPStatusError as exc:
        return {"error": f"LinkedIn API error: {exc.response.status_code} – {exc.response.text}"}
    except Exception as exc:
        return {"error": f"Failed to get profile: {exc}"}


async def publish_post(text: str, image_url: str | None, access_token: str) -> dict[str, Any]:
    """Create a LinkedIn share post (text-only or with an image link).

    Uses the UGC Posts API.
    """
    try:
        profile = await get_profile(access_token)
        if "error" in profile:
            return profile
        person_urn = f"urn:li:person:{profile['id']}"

        media_content: list[dict] = []
        if image_url:
            media_content.append({
                "status": "READY",
                "originalUrl": image_url,
                "media": image_url,
            })

        share_content: dict[str, Any] = {
            "shareCommentary": {"text": text},
            "shareMediaCategory": "IMAGE" if image_url else "NONE",
        }
        if media_content:
            share_content["media"] = media_content

        payload = {
            "author": person_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": share_content,
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{LINKEDIN_API_URL}/ugcPosts",
                headers=_auth_headers(access_token),
                json=payload,
            )
            resp.raise_for_status()
            return {"post_id": resp.json().get("id"), "status": "published"}
    except httpx.HTTPStatusError as exc:
        return {"error": f"LinkedIn API error: {exc.response.status_code} – {exc.response.text}"}
    except Exception as exc:
        return {"error": f"Failed to publish post: {exc}"}


async def get_notifications(access_token: str) -> dict[str, Any]:
    """Fetch recent LinkedIn notifications for the authenticated user."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{LINKEDIN_API_URL}/socialActions",
                headers=_auth_headers(access_token),
                params={"q": "reader", "count": 20},
            )
            resp.raise_for_status()
            elements = resp.json().get("elements", [])

            notifications = []
            for el in elements:
                notifications.append({
                    "type": el.get("$type", "unknown"),
                    "actor": el.get("actor"),
                    "created": el.get("created", {}).get("time"),
                    "target": el.get("target"),
                })

            return {"notifications": notifications, "count": len(notifications)}
    except httpx.HTTPStatusError as exc:
        return {"error": f"LinkedIn API error: {exc.response.status_code} – {exc.response.text}"}
    except Exception as exc:
        return {"error": f"Failed to get notifications: {exc}"}


async def generate_thought_leadership(topic: str, brand_voice: str) -> dict[str, Any]:
    """Use Groq AI to draft a LinkedIn thought-leadership post."""
    try:
        prompt = (
            f"Write a LinkedIn thought-leadership post about: {topic}\n"
            f"Brand voice: {brand_voice}\n\n"
            "Return ONLY valid JSON with:\n"
            "- headline: a compelling opening line (max 20 words)\n"
            "- body: the post body (150-250 words, professional tone, line breaks for readability)\n"
            "- hashtags: list of 3-5 relevant hashtags\n"
            "- cta: a call-to-action closing line"
        )
        result = await _groq_chat(
            system="You are a LinkedIn thought-leadership ghostwriter. Return only valid JSON.",
            prompt=prompt,
            temperature=0.7,
            max_tokens=600,
        )
        return {
            "headline": result.get("headline", ""),
            "body": result.get("body", ""),
            "hashtags": result.get("hashtags", []),
            "cta": result.get("cta", ""),
        }
    except Exception as exc:
        return {"error": f"Failed to generate thought leadership: {exc}"}
