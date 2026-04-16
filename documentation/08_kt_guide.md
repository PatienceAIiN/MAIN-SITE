# Knowledge Transfer Guide — New Employees

Welcome to the PATIENCE AI engineering team. This guide will get you productive on the main site codebase within your first day.

---

## What Is This Project?

The **PATIENCE AI Main Site** (`patienceai.in`) is the company's public-facing website and platform. It includes:

- **Marketing pages** (Home, Products, Platform, Careers, Blog)
- **AI chat assistant** (powered by Groq / LLaMA) that answers visitor questions in real time
- **Contact & demo request forms** with automated email notifications
- **Admin dashboard** (`/admin`) for managing form submissions, site content, and chat history
- **Live CMS** — all site text and images are editable from the admin panel without a code deploy

---

## Day 1 Checklist

- [ ] Get access to the GitHub repository (`PatienceAIiN/MAIN-SITE`)
- [ ] Get access to Render dashboard (`render.com`) — ask your manager
- [ ] Get access to Neon dashboard (`neon.tech`) — ask your manager
- [ ] Get access to Groq console (`console.groq.com`) — ask your manager
- [ ] Get access to GoDaddy account for email credentials
- [ ] Clone the repo and run locally (see steps below)
- [ ] Log in to `/admin` locally and explore the dashboard
- [ ] Read this guide end-to-end

---

## Setting Up Locally

```bash
# 1. Clone the repo
git clone https://github.com/PatienceAIiN/MAIN-SITE.git
cd MAIN-SITE

# 2. Install dependencies
npm install

# 3. Create your .env file
# Ask your manager for the actual credential values
# Reference: documentation/06_environment_variables.md

# 4. Start the dev server
npm run dev
# → Frontend: http://localhost:5173
# → API:      http://localhost:3000
# → Both run concurrently; /api/* requests are proxied

# 5. Open the site
open http://localhost:5173

# 6. Open the admin panel
open http://localhost:5173/admin
```

---

## Codebase Tour (30-minute walkthrough)

### 1. Server Entry (`server.js`)
This is where the Express server is configured. It loads `.env`, registers all API routes, and serves the built React app. Read this first — it's only ~100 lines.

### 2. API Layer (`api/`)

| File | What it does |
|---|---|
| `_db.js` | All database logic — connection, table creation, query helper |
| `auth.js` | Session login/logout for the admin panel |
| `contact.js` | Contact form handler — saves to DB, sends two emails |
| `admin.js` | CRUD for contact submissions (admin-only) |
| `chat.js` | AI chat — Groq integration, content search, message storage |
| `chat-admin.js` | Chat history viewer (admin-only) |
| `site-content.js` | CMS — read/write all site content |

### 3. Frontend (`src/`)

| Path | What it does |
|---|---|
| `src/main.jsx` | App entry point — React root, Router wrapper |
| `src/App.jsx` | Route definitions, global state (site content, modals) |
| `src/components/` | All UI components (Navbar, Hero, Footer, Chat, Forms…) |
| `src/pages/` | Page-level components (each corresponds to a route) |
| `src/common/` | Shared utilities (fetchJson, icons, SafeIcon) |

### 4. Configuration Files

| File | Purpose |
|---|---|
| `vite.config.js` | Build config, dev proxy, aliases |
| `tailwind.config.js` | Design tokens (colors, fonts) |
| `render.yaml` | Render deployment config |
| `eslint.config.js` | Linting rules |

---

## Key Concepts

### How Site Content Works
All text/images on the site come from the database, not hardcoded in JSX. The `App.jsx` polls `/api/site-content` every 4 seconds and re-renders the whole page with the latest content. Admins edit content via the `/admin` panel in real time.

### How the AI Chat Works
1. User sends a message via the chat widget
2. `/api/chat` searches the site content JSON for relevant context
3. It builds a prompt with that context and sends it to Groq (LLaMA model)
4. The response is streamed back to the user
5. All messages are saved to the `chatbot_messages` table

### How Authentication Works
Single admin user — credentials in env vars. On login, a signed cookie (`pa_admin_session`) is set. Every admin API route checks this cookie. No database lookup on each request — it's all HMAC-verified in memory.

### How Email Works
Nodemailer connects to GoDaddy's SMTP server and sends two emails on each form submission:
1. **Team notification** → `support@patienceai.in` (so the team knows about the lead)
2. **User confirmation** → the form submitter's email (professional acknowledgement)

---

## Common Tasks

### Adding a New Page
1. Create `src/pages/NewPage.jsx`
2. Add a route in `src/App.jsx`: `<Route path="/new-page" element={<NewPage />} />`
3. Add the nav link to the site content (via admin panel or default JSON)

### Adding a New API Route
1. Create `api/new-route.js` with a default export handler function
2. Import and register it in `server.js`:
   ```javascript
   import newHandler from './api/new-route.js';
   app.all('/api/new-route', wrap(newHandler));
   ```

### Changing Site Text/Images
- **Option A (no deploy needed):** Log in to `/admin`, go to Site Content editor, make changes live
- **Option B (code change):** Edit `api/site-content.js` → the `defaultContent` object

### Updating Email Configuration
Update the SMTP env vars in Render dashboard (see [06_environment_variables.md](06_environment_variables.md)). No code change needed.

### Checking Contact Form Submissions
Log in to `/admin` → Contact Submissions tab. You can filter by status and update/archive entries.

---

## Git Workflow

```bash
# Always work from main (small team, no feature branches required)
git pull origin main

# Make your changes, then:
git add <files>
git commit -m "Brief description of what and why"
git push origin main
# → Render auto-deploys within 2-3 minutes
```

For significant features, create a branch and open a PR for review.

---

## Debugging Tips

### Email Not Sending?
Check the server console for `Owner email error:` or `User confirmation email error:`. The message after the colon is the SMTP error. Common causes: wrong password, wrong port, sender address not matching auth user.

### AI Chat Not Responding?
Check for `GROQ_API_KEY` in env vars. If Groq is down, the chat falls back to rule-based responses (`degraded: true` in the API response).

### Database Errors?
Look for `Neon insert error:` in logs. Check `DATABASE_URL` is set correctly and the Neon project is active (free tier projects pause after inactivity — resume at neon.tech dashboard).

### Site Content Not Updating?
The frontend polls every 4 seconds. If changes in admin don't appear, check the browser console for errors on `/api/site-content` requests.

### Admin Login Not Working?
Verify `ADMIN_USERNAME` and `ADMIN_PASSWORD` env vars are set on Render. Clear browser cookies and try again.

---

## Contacts & Resources

| Resource | Link |
|---|---|
| GitHub repo | https://github.com/PatienceAIiN/MAIN-SITE |
| Render dashboard | https://dashboard.render.com |
| Neon dashboard | https://console.neon.tech |
| Groq console | https://console.groq.com |
| GoDaddy email | https://email.godaddy.com |
| Live site | https://patienceai.in |
| Admin panel | https://patienceai.in/admin |

---

## Glossary

| Term | Meaning |
|---|---|
| **Neon** | Serverless PostgreSQL database provider |
| **Groq** | AI inference provider running LLaMA models |
| **Render** | Cloud hosting platform (like Heroku) |
| **Vite** | Modern JavaScript build tool (replaces Webpack/CRA) |
| **Framer Motion** | React animation library |
| **Tailwind CSS** | Utility-first CSS framework |
| **SMTP** | Simple Mail Transfer Protocol — how emails are sent |
| **SPA** | Single Page Application — the whole frontend is one HTML page, routing is done in JavaScript |
| **CMS** | Content Management System — the admin panel's site content editor |
| **HMR** | Hot Module Replacement — Vite reloads changed code without full page refresh during dev |
