import os
import json
import email
import asyncio
import imaplib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any

import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


async def _groq_chat(system: str, prompt: str, temperature: float = 0.5, max_tokens: int = 500) -> dict:
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


def _imap_fetch_sync(imap_config: dict[str, Any], max_messages: int = 20) -> list[dict]:
    """Synchronous IMAP fetch – called via asyncio.to_thread."""
    host = imap_config["host"]
    port = imap_config.get("port", 993)
    username = imap_config["username"]
    password = imap_config["password"]
    folder = imap_config.get("folder", "INBOX")

    conn = imaplib.IMAP4_SSL(host, port)
    conn.login(username, password)
    conn.select(folder, readonly=True)

    _status, data = conn.search(None, "ALL")
    msg_ids = data[0].split()
    # Take the most recent N messages
    recent_ids = msg_ids[-max_messages:] if len(msg_ids) > max_messages else msg_ids

    results: list[dict] = []
    for mid in reversed(recent_ids):
        _status, msg_data = conn.fetch(mid, "(RFC822)")
        if msg_data and msg_data[0] is not None:
            raw = msg_data[0]
            if isinstance(raw, tuple) and len(raw) >= 2:
                raw_email = raw[1]
            else:
                continue
            msg = email.message_from_bytes(raw_email)
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    ct = part.get_content_type()
                    if ct == "text/plain":
                        payload = part.get_payload(decode=True)
                        if payload:
                            body = payload.decode(errors="replace")
                        break
            else:
                payload = msg.get_payload(decode=True)
                if payload:
                    body = payload.decode(errors="replace")

            results.append({
                "message_id": msg.get("Message-ID", ""),
                "from": msg.get("From", ""),
                "to": msg.get("To", ""),
                "subject": msg.get("Subject", ""),
                "date": msg.get("Date", ""),
                "body": body[:2000],
            })

    conn.logout()
    return results


async def fetch_emails(imap_config: dict[str, Any]) -> dict[str, Any]:
    """Fetch recent emails from an IMAP mailbox.

    imap_config keys: host, port (default 993), username, password, folder (default INBOX).
    """
    try:
        messages = await asyncio.to_thread(_imap_fetch_sync, imap_config)
        return {"emails": messages, "count": len(messages)}
    except imaplib.IMAP4.error as exc:
        return {"error": f"IMAP error: {exc}"}
    except Exception as exc:
        return {"error": f"Failed to fetch emails: {exc}"}


def _smtp_send_sync(
    smtp_config: dict[str, Any],
    to: str,
    subject: str,
    body: str,
    reply_to_message_id: str | None = None,
) -> dict:
    """Synchronous SMTP send – called via asyncio.to_thread."""
    host = smtp_config["host"]
    port = smtp_config.get("port", 587)
    username = smtp_config["username"]
    password = smtp_config["password"]
    from_email = smtp_config.get("from_email", username)

    msg = MIMEMultipart("alternative")
    msg["From"] = from_email
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to_message_id:
        msg["In-Reply-To"] = reply_to_message_id
        msg["References"] = reply_to_message_id

    msg.attach(MIMEText(body, "plain", "utf-8"))

    use_ssl = port == 465
    if use_ssl:
        server = smtplib.SMTP_SSL(host, port, timeout=30)
    else:
        server = smtplib.SMTP(host, port, timeout=30)
        server.starttls()

    server.login(username, password)
    server.sendmail(from_email, [to], msg.as_string())
    server.quit()

    return {"status": "sent", "to": to, "subject": subject}


async def send_email(
    smtp_config: dict[str, Any],
    to: str,
    subject: str,
    body: str,
    reply_to_message_id: str | None = None,
) -> dict[str, Any]:
    """Send an email via SMTP.

    smtp_config keys: host, port (default 587), username, password, from_email.
    """
    try:
        result = await asyncio.to_thread(
            _smtp_send_sync, smtp_config, to, subject, body, reply_to_message_id
        )
        return result
    except smtplib.SMTPException as exc:
        return {"error": f"SMTP error: {exc}"}
    except Exception as exc:
        return {"error": f"Failed to send email: {exc}"}


async def classify_email(subject: str, body: str) -> dict[str, Any]:
    """Use Groq AI to classify the intent of an email.

    Returns category, urgency, and suggested action.
    """
    try:
        prompt = (
            f"Classify this email:\nSubject: {subject}\nBody: {body[:1500]}\n\n"
            "Return ONLY valid JSON with:\n"
            "- category: one of (inquiry, complaint, support, sales_lead, partnership, spam, newsletter, other)\n"
            "- urgency: one of (high, medium, low)\n"
            "- summary: one-sentence summary of the email\n"
            "- suggested_action: recommended next step"
        )
        result = await _groq_chat(
            system="You are an email classification expert. Return only valid JSON.",
            prompt=prompt,
            temperature=0.2,
            max_tokens=300,
        )
        return {
            "category": result.get("category", "other"),
            "urgency": result.get("urgency", "low"),
            "summary": result.get("summary", ""),
            "suggested_action": result.get("suggested_action", ""),
        }
    except Exception as exc:
        return {"error": f"Failed to classify email: {exc}"}


async def generate_reply(
    email_content: str, brand_voice: str, context: str = ""
) -> dict[str, Any]:
    """Use Groq AI to generate a professional reply to an email.

    Args:
        email_content: The email text to reply to.
        brand_voice: Tone/style description (e.g. "professional and warm").
        context: Optional extra context (FAQs, prior conversation, etc.).
    """
    try:
        prompt = (
            f"Generate a professional reply to this email:\n\n{email_content[:2000]}\n\n"
            f"Brand voice: {brand_voice}\n"
            f"Additional context: {context[:500]}\n\n"
            "Return ONLY valid JSON with:\n"
            "- subject: reply subject line\n"
            "- body: the reply text (professional, concise, helpful)\n"
            "- tone: the tone used"
        )
        result = await _groq_chat(
            system="You are a professional email copywriter. Return only valid JSON.",
            prompt=prompt,
            temperature=0.5,
            max_tokens=500,
        )
        return {
            "subject": result.get("subject", ""),
            "body": result.get("body", ""),
            "tone": result.get("tone", ""),
        }
    except Exception as exc:
        return {"error": f"Failed to generate reply: {exc}"}
