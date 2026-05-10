"""
Image generation service.
Primary:   Pollinations.ai  (free, no API key needed)
Fallback:  Together AI FLUX (if TOGETHER_API_KEY is set)
"""
import os
import base64
import urllib.parse
from datetime import datetime
from pathlib import Path
import httpx

IMAGES_DIR = Path(__file__).parent.parent.parent / "images"
TOGETHER_URL = "https://api.together.xyz/v1/images/generations"


async def generate_image(prompt: str) -> str:
    IMAGES_DIR.mkdir(exist_ok=True)
    api_key = os.getenv("TOGETHER_API_KEY", "").strip()
    style_prefix = os.getenv("IMAGE_STYLE_PREFIX", "")
    full_prompt = f"{style_prefix} {prompt}".strip() if style_prefix else prompt

    if api_key:
        try:
            return await _together(full_prompt, api_key)
        except Exception as e:
            print(f"[image] Together failed ({e}), using Pollinations")

    return await _pollinations(full_prompt)


async def _together(prompt: str, api_key: str) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            TOGETHER_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "black-forest-labs/FLUX.1-schnell", "prompt": prompt,
                  "width": 1024, "height": 1024, "steps": 4, "n": 1, "response_format": "b64_json"},
        )
        resp.raise_for_status()
        return _save(base64.b64decode(resp.json()["data"][0]["b64_json"]), "png")


async def _pollinations(prompt: str) -> str:
    # Return direct CDN URL — always accessible from any browser, no local disk needed
    encoded = urllib.parse.quote(prompt)
    seed = abs(hash(prompt)) % 99999
    return (f"https://image.pollinations.ai/prompt/{encoded}"
            f"?width=1024&height=1024&nologo=true&model=flux&seed={seed}")


def _save(data: bytes, ext: str) -> str:
    filename = f"generated_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"
    (IMAGES_DIR / filename).write_bytes(data)
    return f"/images/{filename}"
