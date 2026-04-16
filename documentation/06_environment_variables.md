# Environment Variables

All variables are loaded from `.env` (local dev) or the Render dashboard (production).  
**Never commit `.env` to git.** See `.gitignore` — it is already excluded.

---

## Complete Reference

### Database

| Variable | Required | Example | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://user:pass@host/db?sslmode=require&channel_binding=require` | Neon PostgreSQL connection string |

### Admin Panel

| Variable | Required | Example | Description |
|---|---|---|---|
| `ADMIN_USERNAME` | Yes | `admin` | Username for `/admin` login |
| `ADMIN_PASSWORD` | Yes | `StrongPass@123` | Password for `/admin` login |
| `ADMIN_SESSION_SECRET` | Yes | `random32charstring` | HMAC key for signing session cookies. Must be long and random. |

### Email (SMTP)

| Variable | Required | Example | Description |
|---|---|---|---|
| `SMTP_HOST` | Yes | `smtpout.secureserver.net` | GoDaddy SMTP host. Use `smtp.office365.com` if on Microsoft 365 plan. |
| `SMTP_PORT` | Yes | `465` | SMTP port. `465` for SSL, `587` for STARTTLS. |
| `SMTP_SECURE` | Yes | `true` | `true` for port 465 (SSL). `false` for port 587 (STARTTLS). |
| `SMTP_USER` | Yes | `growth@patienceai.in` | Full email address used as the sender. |
| `SMTP_PASS` | Yes | `YourEmailPassword` | Password for the sender email account. |
| `SMTP_SENDER_NAME` | No | `Patience AI` | Display name shown in From field. Defaults to `PATIENCE AI`. |
| `CONTACT_TO_EMAIL` | Yes | `support@patienceai.in` | Recipient for contact form notifications. Supports comma-separated list. |

### AI

| Variable | Required | Example | Description |
|---|---|---|---|
| `GROQ_API_KEY` | Yes | `gsk_...` | Groq API key. Get from console.groq.com |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Override the AI model. Defaults to `llama-3.3-70b-versatile`. |

### General

| Variable | Required | Example | Description |
|---|---|---|---|
| `SITE_URL` | No | `patienceai.in` | Public domain (no https://). Used for canonical URLs. |
| `PORT` | No | `3000` | Express server port. Render sets this automatically. |
| `NODE_ENV` | No | `production` | Set to `production` in Render. |

---

## Local `.env` Template

Save this as `.env` in the project root and fill in your values:

```env
# Database
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require&channel_binding=require

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=

# Email (GoDaddy SMTP)
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=growth@patienceai.in
SMTP_PASS=
SMTP_SENDER_NAME=Patience AI
CONTACT_TO_EMAIL=support@patienceai.in

# AI
GROQ_API_KEY=

# General
SITE_URL=patienceai.in
```

---

## Render Setup

1. Go to [Render Dashboard](https://dashboard.render.com) → `patience-ai` service
2. Click **Environment** tab
3. Add each variable above as a key-value pair
4. Click **Save Changes** — Render will trigger a redeploy automatically

---

## Security Notes

- `ADMIN_SESSION_SECRET` should be at least 32 random characters. Generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `SMTP_PASS` is the actual GoDaddy email account password — treat it as a secret
- Never log or expose these values in API responses
- Rotate `ADMIN_SESSION_SECRET` if you suspect it has been compromised (all existing sessions will be invalidated)
