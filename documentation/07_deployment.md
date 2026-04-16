# Deployment Guide

## Overview

The site runs as a single Node.js process on **Render**. The build step compiles the React frontend (Vite → `dist/`), and the start step runs Express which serves both the API and the static frontend.

```
npm ci && npm run build   ← build step
npm start                 ← start step (node server.js)
```

---

## Deploy to Render (Standard Flow)

Every push to the `main` branch on GitHub automatically triggers a deploy on Render. No manual action needed.

```bash
git push origin main
# Render detects the push → runs build → restarts service
```

Monitor the deploy at: Render Dashboard → patience-ai → Logs

---

## Manual Redeploy

If you need to redeploy without a code change (e.g. after updating env vars):

1. Go to [Render Dashboard](https://dashboard.render.com) → `patience-ai`
2. Click **Manual Deploy** → **Deploy latest commit**

---

## First-Time Setup on Render

If setting up from scratch:

1. Log in to [Render](https://render.com)
2. Click **New** → **Web Service**
3. Connect GitHub → select `PatienceAIiN/MAIN-SITE`
4. Configure:
   - **Name:** `patience-ai`
   - **Runtime:** Node
   - **Branch:** `main`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free (or Starter for better performance)
5. Add all environment variables (see [06_environment_variables.md](06_environment_variables.md))
6. Click **Create Web Service**

Render will run the first deploy automatically.

---

## Local Development

```bash
# Clone the repo
git clone https://github.com/PatienceAIiN/MAIN-SITE.git
cd MAIN-SITE

# Install dependencies
npm install

# Set up environment
cp documentation/06_environment_variables.md .env
# Edit .env with real values

# Start dev server (Vite on 5173 + Express on 3000, proxied)
npm run dev
```

The dev setup runs two processes concurrently via `scripts/dev.mjs`:
- **Vite** on `http://localhost:5173` (frontend, HMR)
- **Express** on `http://localhost:3000` (API)

All `/api/*` requests from Vite are proxied to Express automatically.

---

## Production Build Locally

```bash
npm run build   # Runs ESLint, then Vite build → dist/
npm start       # Serves dist/ + API on http://localhost:3000
```

---

## Environment Variables on Render

After changing env vars in the Render dashboard, the service **automatically redeploys**. Keep this in mind — only make changes during low-traffic periods if the change affects production email or DB credentials.

---

## Health Check

Render pings `GET /` to verify the service is alive. Express responds with `dist/index.html`. If `dist/` doesn't exist, it returns `"Build output not found"` (500 — this means the build failed).

---

## Rollback

To roll back to a previous deploy:

1. Render Dashboard → patience-ai → **Deploys** tab
2. Click any previous successful deploy → **Rollback to this deploy**

Or via git:
```bash
git revert HEAD       # Creates a revert commit
git push origin main  # Triggers auto-deploy of the revert
```

---

## Logs

View live logs: Render Dashboard → patience-ai → **Logs**

Key things to look for:
- `Server listening on 3000` — server started successfully
- `Neon insert error:` — DB connectivity issue
- `Owner email error:` / `User confirmation email error:` — SMTP issue
- `Brevo` references — leftover from old config, should not appear

---

## Render Free Tier Limitations

- Service **spins down after 15 minutes of inactivity**
- First request after spin-down takes ~30s (cold start)
- Upgrade to **Starter plan** ($7/month) to eliminate cold starts
