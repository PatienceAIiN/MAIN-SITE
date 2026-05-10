"""Email service — IMAP (read/delete) + SMTP (send) for Titan/GoDaddy mail."""
import os
import imaplib
import email as email_lib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import decode_header
from typing import Optional
import asyncio


def _cfg():
    return {
        "host": os.getenv("SMTP_HOST", ""),
        "user": os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASS", ""),
        "imap_port": int(os.getenv("IMAP_PORT", "993")),
        "smtp_port": int(os.getenv("SMTP_PORT", "465")),
    }


def _decode_str(s):
    if not s:
        return ""
    parts = decode_header(s)
    out = []
    for part, enc in parts:
        if isinstance(part, bytes):
            out.append(part.decode(enc or "utf-8", errors="replace"))
        else:
            out.append(str(part))
    return " ".join(out)


def _get_body(msg) -> str:
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            if ct == "text/plain" and "attachment" not in cd:
                try:
                    body = part.get_payload(decode=True).decode(errors="replace")
                    break
                except Exception:
                    pass
            elif ct == "text/html" and not body:
                try:
                    body = part.get_payload(decode=True).decode(errors="replace")
                except Exception:
                    pass
    else:
        try:
            body = msg.get_payload(decode=True).decode(errors="replace")
        except Exception:
            body = str(msg.get_payload())
    return body


# ── Sync helpers (run in executor) ──────────────────────────────────────────

def _sync_fetch_emails(limit: int = 50):
    c = _cfg()
    if not c["host"] or not c["user"] or not c["password"]:
        return []
    try:
        mail = imaplib.IMAP4_SSL(c["host"], c["imap_port"])
        mail.login(c["user"], c["password"])
        mail.select("INBOX")
        _, data = mail.search(None, "ALL")
        all_ids = data[0].split()
        ids = list(reversed(all_ids[-limit:] if len(all_ids) > limit else all_ids))
        emails = []
        for uid in ids:
            _, msg_data = mail.fetch(uid, "(RFC822)")
            for part in msg_data:
                if isinstance(part, tuple):
                    msg = email_lib.message_from_bytes(part[1])
                    emails.append({
                        "uid": uid.decode(),
                        "from_addr": _decode_str(msg.get("From", "")),
                        "to_addr": _decode_str(msg.get("To", "")),
                        "subject": _decode_str(msg.get("Subject", "(no subject)")),
                        "date": msg.get("Date", ""),
                        "body": _get_body(msg),
                        "message_id": msg.get("Message-ID", ""),
                        "read": False,
                    })
        mail.logout()
        return emails
    except Exception as e:
        print(f"[email] IMAP fetch error: {e}")
        return []


def _sync_delete_email(uid: str):
    c = _cfg()
    mail = imaplib.IMAP4_SSL(c["host"], c["imap_port"])
    mail.login(c["user"], c["password"])
    mail.select("INBOX")
    mail.store(uid.encode(), "+FLAGS", "\\Deleted")
    mail.expunge()
    mail.logout()


def _sync_send_email(to: str, subject: str, body: str, reply_to_header: Optional[str] = None):
    c = _cfg()
    sender_name = os.getenv("SMTP_SENDER_NAME", "")
    msg = MIMEMultipart("alternative")
    msg["From"] = f"{sender_name} <{c['user']}>" if sender_name else c["user"]
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to_header:
        msg["In-Reply-To"] = reply_to_header
        msg["References"] = reply_to_header
    msg.attach(MIMEText(body, "plain"))
    with smtplib.SMTP_SSL(c["host"], c["smtp_port"]) as server:
        server.login(c["user"], c["password"])
        server.sendmail(c["user"], [to], msg.as_string())


def _sync_test_imap():
    c = _cfg()
    if not c["host"] or not c["user"] or not c["password"]:
        return False, "IMAP not configured"
    try:
        mail = imaplib.IMAP4_SSL(c["host"], c["imap_port"])
        mail.login(c["user"], c["password"])
        mail.select("INBOX")
        mail.logout()
        return True, "Connected"
    except Exception as e:
        return False, str(e)


def _sync_test_smtp():
    c = _cfg()
    if not c["host"] or not c["user"] or not c["password"]:
        return False, "SMTP not configured"
    try:
        with smtplib.SMTP_SSL(c["host"], c["smtp_port"]) as server:
            server.login(c["user"], c["password"])
        return True, "Connected"
    except Exception as e:
        return False, str(e)


# ── Async wrappers ───────────────────────────────────────────────────────────

async def get_emails(limit: int = 50):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_fetch_emails, limit)


async def delete_email(uid: str):
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _sync_delete_email, uid)


async def send_email(to: str, subject: str, body: str, reply_to_header: Optional[str] = None):
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _sync_send_email, to, subject, body, reply_to_header)


async def test_imap():
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_test_imap)


async def test_smtp():
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_test_smtp)
