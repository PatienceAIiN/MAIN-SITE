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
| Email | Nodemailer → GoDaddy SMTP |
| AI Chat | Groq API (LLaMA-3.3-70B) |
| Build | Vite 5 |
| Deploy | Render (Web Service) |

## Project Structure

```
├── api/                  # Express route handlers
│   ├── _db.js            # Neon DB connection + schema
│   ├── admin.js          # Admin CRUD for submissions
│   ├── auth.js           # Session auth
│   ├── chat.js           # AI chatbot
│   ├── chat-admin.js     # Chat history admin
│   ├── contact.js        # Contact form + email
│   └── site-content.js   # CMS content
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

## Admin Panel

Navigate to `/admin` in the browser. Credentials are set via `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars.

## License

Private — PATIENCE AI. All rights reserved.
