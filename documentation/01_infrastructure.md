# Infrastructure & Configuration

## Domain

| Property | Value |
|---|---|
| Primary domain | `patienceai.in` |
| Env variable | `SITE_URL=patienceai.in` |
| DNS managed via | GoDaddy |
| SSL | Managed by Render (auto TLS) |

## Hosting — Render

| Property | Value |
|---|---|
| Provider | [Render](https://render.com) |
| Service type | Web Service |
| Plan | Free (upgradeable) |
| Region | Oregon (US West) |
| Service name | `patience-ai` |
| Live URL | `https://patienceai.onrender.com` |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check | `GET /` |
| Auto-deploy | Yes — triggered on push to `main` |

### Render Environment Variables to Set

Go to Render Dashboard → patience-ai → Environment:

```
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
ADMIN_USERNAME=
CONTACT_TO_EMAIL=
DATABASE_URL=
GROQ_API_KEY=
SITE_URL=patienceai.in
SMTP_HOST=smtpout.secureserver.net
SMTP_PASS=
SMTP_PORT=465
SMTP_SECURE=true
SMTP_SENDER_NAME=Patience AI
SMTP_USER=growth@patienceai.in
```

## Database — Neon PostgreSQL

| Property | Value |
|---|---|
| Provider | [Neon](https://neon.tech) |
| Type | Serverless PostgreSQL |
| Region | US East 1 (AWS) |
| Access method | HTTP API (no persistent connection) |
| Connection var | `DATABASE_URL` |
| Connection format | `postgresql://user:pass@host/db?sslmode=require&channel_binding=require` |

**Tables auto-created** on first request (no manual migration needed):
- `admin_users`
- `site_content`
- `contact_submissions`
- `chatbot_messages`

## Email — GoDaddy Workspace Email

| Property | Value |
|---|---|
| Provider | GoDaddy Workspace Email |
| Sender address | `growth@patienceai.in` |
| SMTP host | `smtpout.secureserver.net` |
| SMTP port | `465` (SSL) |
| Auth | Username + Password |
| Recipient (contact forms) | `support@patienceai.in` |

> **Note:** If GoDaddy plan uses Microsoft 365, use `smtp.office365.com` port `587` with `SMTP_SECURE=false`.

## AI — Groq API

| Property | Value |
|---|---|
| Provider | [Groq](https://console.groq.com) |
| Model | `llama-3.3-70b-versatile` (default) |
| Custom model | Set `GROQ_MODEL` env var |
| API key var | `GROQ_API_KEY` |
| Purpose | Powers the on-site AI chat assistant |

## Source Control — GitHub

| Property | Value |
|---|---|
| Organisation | `PatienceAIiN` |
| Repository | `MAIN-SITE` |
| Default branch | `main` |
| Deploy trigger | Push to `main` → Render auto-deploys |

## Admin Panel

| Property | Value |
|---|---|
| URL | `https://patienceai.onrender.com/admin` (or `/admin` on any env) |
| Auth | Session cookie (`pa_admin_session`) |
| Credentials | `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars |
| Session TTL | 7 days |
| Session signing | HMAC-SHA256 using `ADMIN_SESSION_SECRET` |
