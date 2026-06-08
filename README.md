# PATIENCE AI — Main Site

Official website and customer-facing platform for **PATIENCE AI** (`patienceai.in`).

## Quick Start

```bash
# Install dependencies
npm install

# Copy env template and fill in values
cp documentation/env.example .env

# Start dev server (Vite + Express concurrently)
npm run dev

# Production build
npm run build
npm start
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 7, Tailwind CSS 3, Framer Motion |
| Backend | Express.js 4 (Node.js) |
| Database | Neon PostgreSQL (serverless, HTTP API) |
| Email | Brevo HTTP API (primary), Nodemailer SMTP (fallback) |
| AI / LLM | Groq API (LLaMA-3.3-70B chat + Whisper-large-v3 STT) |
| TTS | `msedge-tts` (Microsoft Edge neural voices, free, offline) |
| Media | `ffmpeg-static` (bundled binary) |
| Object storage | Cloudflare R2 (S3-compatible, signed URLs via AWS SDK v3) |
| Build | Vite 5 |
| Deploy | Render (Web Service) |

## Project Structure

```
├── api/                       # Express route handlers
│   ├── _db.js                 # Neon DB connection + schema
│   ├── _email.js              # Brevo HTTP + SMTP unified email helper
│   ├── admin.js               # Admin CRUD for submissions
│   ├── auth.js                # Session auth
│   ├── blog-podcast.js        # Auto-generate EN/HI audio for every blog post
│   ├── chat.js                # AI chatbot
│   ├── chat-admin.js          # Chat history admin
│   ├── contact.js             # Contact form + email
│   ├── newsletter.js          # Topic subscriptions + auto-broadcast
│   ├── podcast-translate.js   # English → Hindi pipeline for product podcasts
│   ├── podcast-url.js         # Signed R2 URLs for product podcast files
│   └── site-content.js        # CMS content + diff-driven newsletter broadcast
├── src/
│   ├── components/       # React UI components
│   ├── pages/            # Page-level components
│   └── common/           # Shared utilities
├── documentation/        # Full engineering docs
├── server.js             # Express server entry
├── vite.config.js
└── render.yaml           # Render deployment config
```

## Documentation

All engineering documentation lives in [`documentation/`](documentation/):

| Doc | Description |
|---|---|
| [Infrastructure](documentation/01_infrastructure.md) | Domain, hosting, DNS, keys |
| [Tech Stack](documentation/02_tech_stack.md) | All libraries and why |
| [System Design HLD/LLD](documentation/03_system_design.md) | Architecture diagrams and flows |
| [API Reference](documentation/04_api_reference.md) | All endpoints documented |
| [Database Schema](documentation/05_database.md) | Tables, indexes, access patterns |
| [Environment Variables](documentation/06_environment_variables.md) | All env vars with descriptions |
| [Deployment Guide](documentation/07_deployment.md) | How to deploy and release |
| [KT Guide — New Employees](documentation/08_kt_guide.md) | Onboarding knowledge transfer |

## Key Features

### Podcasts (`/company/podcast`)
- Three **Product Podcasts** (Nexus Exchange, Pariksha Ki Taiyari, About Patience AI) served from Cloudflare R2 via short-lived signed URLs.
- **Hindi versions** are auto-generated on first request: Groq Whisper transcribes the English audio, Llama-3.3 translates the transcript to Hindi (Devanagari), `msedge-tts` synthesizes a Hindi voice track, `ffmpeg` concatenates segments, and the result is cached to R2 for instant subsequent playback.
- Every blog post is **auto-converted to an audio podcast** in EN + HI on first request via `/api/blog-podcast?slug=…&lang=en|hi`. UI shows progress and switches to the cached version once ready.
- Global persistent player (bottom-center, Material-style) survives navigation, supports 1× → 2× speed cycling, and only closes when the user explicitly closes it.

### Newsletter (`/api/newsletter`)
- Email + topic chips (Products, Podcast, Blog, Features, Integrations, Terms & Privacy).
- **Auto-confirm** on subscribe; non-blocking welcome email via Brevo.
- Every outgoing email carries a one-click **Unsubscribe** link tied to a cryptographic per-row token.
- Admin saves to site content auto-trigger **topic-targeted broadcasts** (e.g. new blog post → "blog" subscribers).

### Forms
- Unified [`FormStatus`](src/components/FormStatus.jsx) renderer keeps Contact, Sales, Demo, Careers, and Newsletter forms visually consistent while preserving per-form messaging and submit logic.

## Security

- Cloudflare R2 credentials are server-side only; clients receive **15-min signed URLs**.
- Per-endpoint rate limits: contact (5/hr), newsletter (10/hr), podcast generation (30/min), auth (10 / 15 min).
- Podcast endpoints enforce same-site `Origin`/`Referer` checks.
- Allowlist of R2 keys for product podcasts; sluggrep-validated keys for blog podcasts.
- Newsletter broadcast endpoint requires admin session cookie.
- All SQL via parameterized queries (no string concatenation).

## Admin Panel

Navigate to `/admin` in the browser. Credentials are set via `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars.

## Required Environment Variables (production)

In addition to the standard `BREVO_*`, `SMTP_*`, `DATABASE_URL`, `ADMIN_*`, `GROQ_API_KEY`, `SITE_URL`:

```
R2_ACCOUNT_ID=<cloudflare account id>
R2_ACCESS_KEY_ID=<r2 access key>
R2_SECRET_ACCESS_KEY=<r2 secret>
R2_BUCKET_NAME=exchange
```

See [`documentation/06_environment_variables.md`](documentation/06_environment_variables.md) for the full list with descriptions.

## License

Private — PATIENCE AI. All rights reserved.
