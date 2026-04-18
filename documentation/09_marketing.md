# Marketing, Analytics & SEO Guide

## Overview

Everything implemented is **100% free and open source**. No paid ad spend required.
The stack covers three layers: **tracking** (know what's happening), **indexing** (get discovered), and **reach** (spread the word).

---

## 1. Analytics Stack

### 1a. Self-Hosted Analytics (NeonDB)
Built into the site. No third-party dependency. Stores every page view in the `page_views` table.

**Dashboard:** `https://patienceai.in/admin` → **analytics** tab

| Metric | Where |
|---|---|
| All-time / monthly / weekly / daily views | KPI row at the top |
| Unique visitors (today + week) | KPI row |
| Top pages | Bar chart |
| Traffic sources / referrers | Bar chart |
| Device breakdown | Cards (mobile / tablet / desktop) |
| Browser breakdown | Cards |
| Last 50 visitors (live table) | Bottom of tab |

**How it works:**
- `src/components/Analytics.jsx` fires on every React route change
- Sends `POST /api/analytics` with page path, referrer, session ID
- `api/analytics.js` records to `public.page_views` in NeonDB
- `GET /api/analytics` returns aggregated stats for the dashboard
- Session ID stored in `sessionStorage` — refreshes per browser session
- IP is one-way hashed (privacy-safe) for unique visitor counting

**DB table:** `public.page_views`
```sql
id, page, referrer, device_type, browser, session_id, ip_hash, created_at
```

---

### 1b. Google Analytics 4
**Measurement ID:** `G-3YZ86EQKLG`
**Dashboard:** https://analytics.google.com

Active. Fires `page_view` events on every route change via `Analytics.jsx`.

What you get:
- Realtime users on site right now
- Acquisition (how users found you — Google, direct, social, referral)
- Demographics (country, city, language, age, gender)
- Behaviour (most visited pages, average time on page, bounce rate)
- Conversions (set up goals — e.g. contact form submit)

**How to see live traffic:**
1. Go to analytics.google.com → your property
2. Reports → Realtime → see users active right now

---

### 1c. Microsoft Clarity
**Project ID:** `wdcqmw85yq`
**Dashboard:** https://clarity.microsoft.com

Active. Completely free, unlimited sessions.

What you get:
- **Session recordings** — watch exactly what real users do
- **Heatmaps** — see where users click, tap, and scroll
- **Rage clicks** — spots where users get frustrated
- **Dead clicks** — buttons/links that don't work as expected
- **Scroll depth** — how far users read before leaving

**How to use:**
1. clarity.microsoft.com → your project → Recordings tab
2. Filter by page, device, country, date
3. Click any session to watch a full replay

---

## 2. SEO Setup

### 2a. Meta Tags (index.html)
| Tag | Value |
|---|---|
| `<title>` | Patience AI — Product-First AI for Governance & Enterprise Delivery |
| `meta description` | 160-char optimised description |
| `meta keywords` | AI platform, enterprise AI, AI governance, etc. |
| `canonical` | https://patienceai.in/ |
| `robots` | index, follow, max-image-preview:large |

### 2b. Open Graph (Social Sharing)
When someone shares a link on WhatsApp, LinkedIn, Facebook, Twitter — they see:
- Title, description, and preview image (`/og-image.png`)
- Set `og:image` to a 1200×630px image for best results
- Currently points to `https://patienceai.in/og-image.png` — **upload this file to `public/`**

### 2c. Twitter Cards
Same as OG but for Twitter/X. `summary_large_image` card type is set — shows a big image preview when tweeted.

### 2d. JSON-LD Structured Data
Two schemas embedded in `<head>`:
- `Organization` — tells Google who you are, your logo, URL
- `WebSite` — enables Google Sitelinks search box in search results

Validate at: https://validator.schema.org — paste `https://patienceai.in`

### 2e. Sitemap
Auto-generated at runtime: `https://patienceai.in/sitemap.xml`

Pages included:
| Page | Priority | Change Frequency |
|---|---|---|
| `/` | 1.0 | weekly |
| `/products` | 0.9 | weekly |
| `/platform` | 0.9 | weekly |
| `/company/blog` | 0.8 | daily |
| `/company/careers` | 0.7 | weekly |

To add a new page to the sitemap, edit the `routes` array in `server.js` → sitemap section.

### 2f. Robots.txt
Located at `public/robots.txt`. Allows all major crawlers:
- Googlebot, Bingbot, Slurp (Yahoo), DuckDuckBot
- Baiduspider (China), YandexBot (Russia)
- Facebot (Facebook), Twitterbot, LinkedInBot

Blocks: `/admin` and `/api/` from indexing.

---

## 3. Search Engine Indexing

### 3a. Google Search Console
**URL:** https://search.google.com/search-console
**What to do:**
1. Add property → `https://patienceai.in`
2. Verify via HTML file (place in `public/` → deploy → verify)
3. Sitemaps → submit `sitemap.xml`
4. Use "URL Inspection" to force-index any page immediately

**What you see:**
- Which queries people type to find your site
- Click-through rate from Google search
- Which pages are indexed vs not indexed
- Core Web Vitals (page speed from real users)
- Manual actions / penalties (if any)

### 3b. Bing Webmaster Tools
**URL:** https://www.bing.com/webmasters
Covers Bing + DuckDuckGo + Yahoo combined (~30% of global search).

1. Add site → verify → submit sitemap
2. Use "URL Submission" to index pages instantly (up to 10,000/day free)

### 3c. Yandex Webmaster
**URL:** https://webmaster.yandex.com
Covers Russia, Eastern Europe, Central Asia.

### 3d. IndexNow (Instant Indexing — Bing + Yandex)
Free protocol — ping search engines the moment you publish new content.
API: `https://api.indexnow.org/indexnow?url=https://patienceai.in/company/blog/your-post&key=YOUR_KEY`
Get a free key at: https://www.indexnow.org

---

## 4. Search Engine Verification Meta Tags

To add search console verification without uploading files, add the meta tag to `index.html`:

```html
<!-- Uncomment and fill in after registering -->
<!-- <meta name="google-site-verification" content="YOUR_CODE" /> -->
<!-- <meta name="msvalidate.01" content="YOUR_CODE" /> -->
<!-- <meta name="yandex-verification" content="YOUR_CODE" /> -->
```

These are already in `index.html` as comments — just uncomment and paste your code.

---

## 5. Free Traffic & Reach Channels

### Zero-cost distribution — do these in order:

| # | Platform | What to do | Expected reach |
|---|---|---|---|
| 1 | **Product Hunt** | producthunt.com → Submit product → launch day | 1k–10k visitors in 24hrs |
| 2 | **Hacker News** | news.ycombinator.com → "Show HN: Patience AI — ..." | 500–5k visitors |
| 3 | **Reddit** | r/artificial, r/MachineLearning, r/SideProject, r/startups | 200–2k visitors |
| 4 | **BetaList** | betalist.com → free listing for new products | 100–500 visitors |
| 5 | **AlternativeTo** | alternativeto.net → list as alternative to Salesforce AI, etc. | ongoing organic |
| 6 | **LinkedIn** | Post a thread about the problem you solve | varies |
| 7 | **Twitter/X** | Thread about the product with site link | varies |
| 8 | **Dev.to** | Write a technical article, link to site | 200–1k visitors |
| 9 | **Indie Hackers** | indiehackers.com → product page + milestone posts | 100–500 visitors |

### Blog strategy (SEO compound growth):
Each blog post at `/company/blog/your-post` gets its own URL indexed by Google.
Write posts targeting keywords like:
- "AI governance platform"
- "enterprise AI automation"
- "AI for business delivery"

Google indexes blog pages fastest because `changefreq: daily` is set in the sitemap.

---

## 6. PM2 Process Manager

**Config file:** `ecosystem.config.cjs`

PM2 runs the Express server with auto-restart on crash.

| Setting | Value | Why |
|---|---|---|
| `instances` | 1 | Render free tier is single CPU |
| `exec_mode` | fork | Single instance mode |
| `max_memory_restart` | 400M | Stays within Render free 512MB RAM |
| `autorestart` | true | Restarts if server crashes |
| `restart_delay` | 3000ms | Prevents restart loop |
| `max_restarts` | 10 | Stops infinite crash loop |

**Logs on Render:** Dashboard → your service → Logs tab
```
[PM2] Spawning PM2 daemon...
[PM2] App [patience-ai] launched (1 instances)
Server listening on 3000
```

**Start command (render.yaml):**
```
./node_modules/.bin/pm2-runtime start ecosystem.config.cjs
```
Uses local `node_modules` install — not global — so it always works on Render.

---

## 7. Performance & Core Web Vitals

Good Core Web Vitals = higher Google rankings.

**Test your score:** https://pagespeed.web.dev → enter `https://patienceai.in`

Target scores:
| Metric | Target | What it means |
|---|---|---|
| LCP | < 2.5s | Largest content loads fast |
| FID / INP | < 100ms | Page responds to clicks fast |
| CLS | < 0.1 | Layout doesn't jump around |

**Quick wins already implemented:**
- Font preconnect in `<head>`
- Service worker caches shell files
- Vite builds minified + gzipped JS/CSS

---

## 8. Quick Reference — All Dashboards

| Tool | URL | What you monitor |
|---|---|---|
| **Own Analytics** | patienceai.in/admin → analytics tab | Page views, devices, referrers, live visitors |
| **Google Analytics** | analytics.google.com | Acquisition, behaviour, conversions, demographics |
| **Microsoft Clarity** | clarity.microsoft.com | Session recordings, heatmaps, rage clicks |
| **Google Search Console** | search.google.com/search-console | Search queries, indexing, Core Web Vitals |
| **Bing Webmaster** | bing.com/webmasters | Bing/DuckDuckGo/Yahoo indexing |
| **Google PageSpeed** | pagespeed.web.dev | Performance score, LCP, CLS |
| **Schema Validator** | validator.schema.org | Structured data / rich snippets |
| **OG Debugger** | opengraph.xyz | Social share preview (WhatsApp, LinkedIn) |
| **Twitter Card Validator** | cards-dev.twitter.com/validator | Twitter share preview |
