import os
import json
from enum import Enum
from typing import Any


class Channel(str, Enum):
    TWITTER = "twitter"
    INSTAGRAM = "instagram"
    LINKEDIN = "linkedin"
    REDDIT = "reddit"
    EMAIL = "email"
    CONTACT_FORM = "contact_form"


# Maps each channel to the env var that must be set for it to be considered configured.
_CHANNEL_CONFIG_KEYS: dict[Channel, list[str]] = {
    Channel.TWITTER: ["TWITTER_API_KEY"],
    Channel.INSTAGRAM: ["INSTAGRAM_ACCESS_TOKEN"],
    Channel.LINKEDIN: ["LINKEDIN_ACCESS_TOKEN"],
    Channel.REDDIT: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
    Channel.EMAIL: ["SMTP_HOST", "IMAP_HOST"],
    Channel.CONTACT_FORM: [],  # always available (webhook-based)
}


async def get_channel_status(channel: str) -> dict[str, Any]:
    """Check whether a channel is configured and ready to use.

    Returns a dict with:
        - channel: the channel name
        - configured: bool indicating if required env vars are present
        - missing: list of missing env var names (empty when configured)
    """
    try:
        ch = Channel(channel)
    except ValueError:
        return {
            "channel": channel,
            "configured": False,
            "missing": [],
            "error": f"Unknown channel '{channel}'. Valid channels: {[c.value for c in Channel]}",
        }

    required = _CHANNEL_CONFIG_KEYS.get(ch, [])
    missing = [key for key in required if not os.getenv(key)]
    return {
        "channel": ch.value,
        "configured": len(missing) == 0,
        "missing": missing,
    }


async def route_message(channel: str, action: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Dispatch a message/action to the appropriate channel service.

    Args:
        channel: One of the Channel enum values (e.g. "instagram").
        action: The function name to invoke on the channel service (e.g. "publish_post").
        payload: Keyword arguments forwarded to the channel function.

    Returns:
        The result dict from the channel service function.
    """
    try:
        ch = Channel(channel)
    except ValueError:
        return {"success": False, "error": f"Unknown channel '{channel}'"}

    # Lazy imports to avoid circular dependencies and keep startup lightweight.
    try:
        if ch == Channel.INSTAGRAM:
            from . import instagram_service as svc
        elif ch == Channel.LINKEDIN:
            from . import linkedin_service as svc
        elif ch == Channel.REDDIT:
            from . import reddit_service as svc
        elif ch == Channel.EMAIL:
            from . import email_service as svc
        elif ch == Channel.CONTACT_FORM:
            from . import contact_form_service as svc
        elif ch == Channel.TWITTER:
            return {"success": False, "error": "Twitter channel not yet implemented"}
        else:
            return {"success": False, "error": f"No service for channel '{channel}'"}
    except ImportError as exc:
        return {"success": False, "error": f"Failed to import service for {channel}: {exc}"}

    func = getattr(svc, action, None)
    if func is None or not callable(func):
        return {"success": False, "error": f"Action '{action}' not found on {channel} service"}

    try:
        result = await func(**payload)
        return {"success": True, "channel": ch.value, "action": action, "data": result}
    except Exception as exc:
        return {"success": False, "channel": ch.value, "action": action, "error": str(exc)}
