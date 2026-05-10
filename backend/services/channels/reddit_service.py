import os
import json
import time
import asyncio
import httpx
from typing import Any

REDDIT_OAUTH_URL = "https://oauth.reddit.com"
REDDIT_ACCESS_TOKEN_URL = "https://www.reddit.com/api/v1/access_token"

# ---------- Anti-spam / rate-limiting state ----------
_last_action_ts: float = 0.0
_action_count_window: list[float] = []
MIN_ACTION_INTERVAL_SECONDS = 3.0
MAX_ACTIONS_PER_MINUTE = 10


async def _enforce_rate_limit() -> None:
    """Block until we are allowed to make another action, enforcing human-like delays."""
    global _last_action_ts, _action_count_window

    now = time.monotonic()

    # Purge entries older than 60 s
    _action_count_window[:] = [t for t in _action_count_window if now - t < 60]

    if len(_action_count_window) >= MAX_ACTIONS_PER_MINUTE:
        wait = 60 - (now - _action_count_window[0])
        if wait > 0:
            await asyncio.sleep(wait)

    since_last = now - _last_action_ts
    if since_last < MIN_ACTION_INTERVAL_SECONDS:
        await asyncio.sleep(MIN_ACTION_INTERVAL_SECONDS - since_last)

    _last_action_ts = time.monotonic()
    _action_count_window.append(_last_action_ts)


async def _get_oauth_token(credentials: dict[str, str]) -> str:
    """Obtain a Reddit OAuth bearer token using script-app credentials.

    credentials must contain: client_id, client_secret, username, password.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            REDDIT_ACCESS_TOKEN_URL,
            auth=(credentials["client_id"], credentials["client_secret"]),
            data={
                "grant_type": "password",
                "username": credentials["username"],
                "password": credentials["password"],
            },
            headers={"User-Agent": "PatienceAI/1.0"},
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


def _auth_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "User-Agent": "PatienceAI/1.0",
    }


async def monitor_subreddit(
    subreddit: str, keywords: list[str], credentials: dict[str, str]
) -> dict[str, Any]:
    """Fetch new posts from a subreddit and filter by keywords.

    Returns matching posts (title, selftext, id, url, author, created_utc).
    """
    try:
        await _enforce_rate_limit()
        token = await _get_oauth_token(credentials)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{REDDIT_OAUTH_URL}/r/{subreddit}/new.json",
                params={"limit": 50},
                headers=_auth_headers(token),
            )
            resp.raise_for_status()
            posts = resp.json().get("data", {}).get("children", [])

        lower_keywords = [kw.lower() for kw in keywords]
        matches = []
        for post in posts:
            d = post.get("data", {})
            combined = f"{d.get('title', '')} {d.get('selftext', '')}".lower()
            if any(kw in combined for kw in lower_keywords):
                matches.append({
                    "id": d.get("name"),
                    "title": d.get("title"),
                    "selftext": d.get("selftext", "")[:500],
                    "url": d.get("url"),
                    "author": d.get("author"),
                    "created_utc": d.get("created_utc"),
                })

        return {"subreddit": subreddit, "keywords": keywords, "matches": matches, "total_checked": len(posts)}
    except httpx.HTTPStatusError as exc:
        return {"error": f"Reddit API error: {exc.response.status_code} – {exc.response.text}"}
    except Exception as exc:
        return {"error": f"Failed to monitor subreddit: {exc}"}


async def post_comment(post_id: str, text: str, credentials: dict[str, str]) -> dict[str, Any]:
    """Post a comment on a Reddit thread (by fullname, e.g. t3_abc123)."""
    try:
        await _enforce_rate_limit()
        token = await _get_oauth_token(credentials)

        # Add a small human-like delay before commenting
        await asyncio.sleep(2.0)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{REDDIT_OAUTH_URL}/api/comment",
                headers=_auth_headers(token),
                data={"thing_id": post_id, "text": text},
            )
            resp.raise_for_status()
            result = resp.json()

        return {"status": "posted", "response": result}
    except httpx.HTTPStatusError as exc:
        return {"error": f"Reddit API error: {exc.response.status_code} – {exc.response.text}"}
    except Exception as exc:
        return {"error": f"Failed to post comment: {exc}"}


async def get_mentions(username: str, credentials: dict[str, str]) -> dict[str, Any]:
    """Search Reddit for recent mentions of a username."""
    try:
        await _enforce_rate_limit()
        token = await _get_oauth_token(credentials)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{REDDIT_OAUTH_URL}/search.json",
                params={"q": f'"{username}"', "sort": "new", "limit": 25, "type": "comment"},
                headers=_auth_headers(token),
            )
            resp.raise_for_status()
            items = resp.json().get("data", {}).get("children", [])

        mentions = []
        for item in items:
            d = item.get("data", {})
            mentions.append({
                "id": d.get("name"),
                "body": d.get("body", "")[:500],
                "subreddit": d.get("subreddit"),
                "author": d.get("author"),
                "link_url": d.get("link_url"),
                "created_utc": d.get("created_utc"),
            })

        return {"username": username, "mentions": mentions, "count": len(mentions)}
    except httpx.HTTPStatusError as exc:
        return {"error": f"Reddit API error: {exc.response.status_code} – {exc.response.text}"}
    except Exception as exc:
        return {"error": f"Failed to get mentions: {exc}"}


async def analyze_thread(thread_url: str, credentials: dict[str, str]) -> dict[str, Any]:
    """Fetch a Reddit thread and return structured analysis (top comments, sentiment gist).

    thread_url should be a full reddit URL or a permalink path.
    """
    try:
        await _enforce_rate_limit()
        token = await _get_oauth_token(credentials)

        # Normalise URL to an API-friendly path
        path = thread_url.split("reddit.com")[-1] if "reddit.com" in thread_url else thread_url
        path = path.rstrip("/") + ".json"

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{REDDIT_OAUTH_URL}{path}",
                params={"limit": 30, "depth": 2},
                headers=_auth_headers(token),
            )
            resp.raise_for_status()
            data = resp.json()

        # data is typically a two-element list: [post_listing, comments_listing]
        post_data = {}
        comments: list[dict] = []

        if isinstance(data, list) and len(data) >= 1:
            post_children = data[0].get("data", {}).get("children", [])
            if post_children:
                pd = post_children[0].get("data", {})
                post_data = {
                    "title": pd.get("title"),
                    "selftext": pd.get("selftext", "")[:1000],
                    "score": pd.get("score"),
                    "num_comments": pd.get("num_comments"),
                    "author": pd.get("author"),
                }

        if isinstance(data, list) and len(data) >= 2:
            comment_children = data[1].get("data", {}).get("children", [])
            for c in comment_children[:20]:
                cd = c.get("data", {})
                if cd.get("body"):
                    comments.append({
                        "author": cd.get("author"),
                        "body": cd.get("body", "")[:500],
                        "score": cd.get("score"),
                    })

        return {"post": post_data, "top_comments": comments, "comment_count": len(comments)}
    except httpx.HTTPStatusError as exc:
        return {"error": f"Reddit API error: {exc.response.status_code} – {exc.response.text}"}
    except Exception as exc:
        return {"error": f"Failed to analyze thread: {exc}"}
