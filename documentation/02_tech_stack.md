# Tech Stack

## Overview

PATIENCE AI is a **React SPA** with an **Express.js** backend, both served from the same Node.js process in production. Vite builds the frontend to `dist/` and Express serves it statically alongside API routes.

---

## Frontend

| Library | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI framework |
| React DOM | 18.3.1 | DOM rendering |
| React Router DOM | 7.1.0 | Client-side routing (SPA) |
| Framer Motion | 11.0.8 | Animations (page transitions, modals, hover effects) |
| Tailwind CSS | 3.4.17 | Utility-first CSS styling |
| React Icons | 5.4.0 | Icon library (Feather, Font Awesome, Simple Icons) |
| ECharts | 5.5.0 | Data visualisation charts |
| echarts-for-react | 3.0.2 | React wrapper for ECharts |
| date-fns | 4.1.0 | Date formatting utilities |
| @questlabs/react-sdk | 2.2.92 | Quest onboarding/feedback SDK |

## Backend

| Library | Version | Purpose |
|---|---|---|
| Express | 4.21.2 | HTTP server and API routing |
| Nodemailer | 8.0.5 | SMTP email sending (GoDaddy) |

## Build & Tooling

| Tool | Version | Purpose |
|---|---|---|
| Vite | 5.4.2 | Frontend bundler and dev server |
| @vitejs/plugin-react | 4.3.1 | Vite React/JSX transform |
| PostCSS | 8.4.49 | CSS processing pipeline |
| Autoprefixer | 10.4.20 | Vendor prefix auto-insertion |
| ESLint | 9.9.1 | JavaScript linting |
| eslint-plugin-react-hooks | 5.1.0-rc | React hooks linting rules |
| eslint-plugin-react-refresh | 0.4.11 | HMR safety linting |

## Infrastructure Services

| Service | Purpose |
|---|---|
| Neon PostgreSQL | Serverless database (HTTP API, no connection pool needed) |
| Groq API | LLaMA-3.3-70B inference for AI chat |
| GoDaddy SMTP | Transactional email delivery |
| Render | Cloud hosting, auto-deploy from GitHub |

---

## Architecture Decision Notes

### Why Vite + Express (not Next.js)?
The site needs a custom Express server for its AI chat and admin APIs. Vite builds the frontend to static files, which Express serves — giving full control over the server without a framework's constraints.

### Why Neon (not Supabase/PlanetScale)?
Neon's HTTP API works in serverless/edge environments without a persistent TCP connection. This means no connection pool management and fast cold starts on Render's free tier.

### Why Groq (not OpenAI)?
Groq runs LLaMA models at significantly faster inference speeds (tokens/sec) with a generous free tier, ideal for real-time chat UX.

### Why Nodemailer + GoDaddy (not Brevo/SendGrid)?
The company already owns a GoDaddy email plan with `@patienceai.in` addresses. Using it directly avoids third-party API key dependencies and keeps email "in-house" on the brand domain.

### Why Tailwind CSS?
Rapid iteration on UI without writing custom CSS files. The design system is consistent through Tailwind's constraint-based spacing/color scale.

### Why Framer Motion?
Framer Motion integrates directly with React state and provides hardware-accelerated animations with minimal code — matching the aesthetic, smooth feel the site aims for.
