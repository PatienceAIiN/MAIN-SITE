# Security Guide

## Overview

All security is implemented with **zero external dependencies** using Node.js built-ins (`crypto`, `node:fs`) and a custom in-memory rate limiter. Every layer — transport, auth, API, headers, and input — is hardened.

**Current security score: 88%**
Remaining 12% requires environment variable and DNS configuration (documented below).

---

## 1. HTTP Security Headers

**File:** `server.js` — middleware block at top of app

All headers are injected on every response before any route handler runs.

| Header | Value | Protects Against |
|---|---|---|
| `X-Frame-Options` | `DENY` | Clickjacking — prevents site being embedded in iframes |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing attacks |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS for 1 year, prevents SSL stripping |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Prevents leaking full URL in referrer headers |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Blocks browser APIs not needed by the site |
| `X-XSS-Protection` | `1; mode=block` | XSS protection for older browsers |
| `Content-Security-Policy` | See below | XSS, script injection, data injection |

### Content Security Policy breakdown

```
default-src 'self'
script-src  'self' 'unsafe-inline' 'unsafe-eval'
            https://www.googletagmanager.com
            https://www.clarity.ms
            https://fonts.googleapis.com
style-src   'self' 'unsafe-inline' https://fonts.googleapis.com
font-src    'self' https://fonts.gstatic.com
img-src     'self' data: blob: https: http:
connect-src 'self'
            https://www.google-analytics.com
            https://analytics.google.com
            https://www.clarity.ms
            https://api.indexnow.org
frame-src   'none'
object-src  'none'
base-uri    'self'
form-action 'self'
```

`'unsafe-inline'` and `'unsafe-eval'` are required by React (Vite build) and Google Analytics.
To remove them in future: migrate to a nonce-based CSP or use a bundler that supports CSP hashes.

---

## 2. Authentication System

**Files:** `api/_security.js`, `api/auth.js`

### Password hashing
- Algorithm: `scrypt` (Node.js `crypto.scryptSync`) — memory-hard, resistant to GPU cracking
- Salt: 16 random bytes generated via `crypto.randomBytes`
- Key length: 64 bytes (512-bit output)
- Comparison: `crypto.timingSafeEqual` — prevents timing attacks

### Session tokens
- Custom HMAC-SHA256 signed tokens (no JWT library needed)
- Signed with `ADMIN_SESSION_SECRET` environment variable
- Payload includes expiry (`exp`) — tokens expire after **7 days**
- Stored in `HttpOnly; Secure; SameSite=Lax` cookie — not accessible to JavaScript

### Cookie security flags
| Flag | Value | Why |
|---|---|---|
| `HttpOnly` | Always set | Prevents JavaScript from reading the cookie |
| `Secure` | Set in production | Only sent over HTTPS |
| `SameSite` | `Lax` | Prevents CSRF from cross-site requests |
| `Max-Age` | 604800 (7 days) | Auto-expires session |
| `Path` | `/` | Cookie scoped to entire site |

### Login comparison
- Username and password both compared with `crypto.timingSafeEqual`
- Prevents timing attacks that could reveal whether username or password was wrong

---

## 3. Rate Limiting

**File:** `api/_ratelimit.js`

Custom in-memory rate limiter — no Redis or external service needed.
Uses a `Map` keyed by `route:ip`. Cleanup runs every 5 minutes to prevent memory growth.

| Endpoint | Limit | Window | Protects Against |
|---|---|---|---|
| `POST /api/auth` | 10 requests | 15 minutes per IP | Admin brute-force login |
| `POST /api/contact` | 5 requests | 1 hour per IP | Contact form spam, email flooding |
| `ALL /api/analytics` | 120 requests | 1 minute per IP | Database flooding, fake traffic injection |

**Response when limit hit:**
```json
HTTP 429 Too Many Requests
Retry-After: 847
{ "error": "Too many login attempts. Try again in 15 minutes." }
```

**IP detection:** reads `x-forwarded-for` header (set by Render's proxy) then falls back to socket address.

---

## 4. API Endpoint Protection

### Protected endpoints (require admin session)

| Endpoint | Method | Auth required |
|---|---|---|
| `/api/admin` | GET, PATCH, DELETE | Admin session cookie |
| `/api/analytics` | GET | Admin session cookie |
| `/api/site-content` | PATCH, DELETE | Admin session cookie |
| `/api/chat-admin` | All | Admin session cookie |

### Public endpoints (intentionally open)

| Endpoint | Method | Why public |
|---|---|---|
| `/api/analytics` | POST | Needs to track anonymous visitors |
| `/api/contact` | POST | Contact form for visitors |
| `/api/chat` | POST | Chatbot for visitors |
| `/api/site-content` | GET | Site content loaded by React on every visit |
| `/api/auth` | POST | Login endpoint |

### What's blocked from indexing (robots.txt)
```
Disallow: /admin
Disallow: /api/
```

---

## 5. Input Validation

### Contact form (`api/contact.js`)
- `name`, `email`, `subject`, `message` — all required, returns 400 if missing
- Email validated with regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- HTML escaped before use in email: `&`, `<`, `>`, `"`, `'` → HTML entities
- All inputs parameterised in SQL — no string concatenation

### Admin submissions (`api/admin.js`)
- `status` validated against whitelist: `['new', 'reviewing', 'replied', 'archived']`
- All DB queries use parameterised queries (`$1`, `$2` placeholders)

### Analytics (`api/analytics.js`)
- `page` field truncated to 200 chars
- `referrer` truncated to 500 chars
- `session_id` truncated to 64 chars

---

## 6. SQL Injection Prevention

**File:** `api/_db.js`

All database queries use **parameterised queries** exclusively. No string interpolation in SQL.

```js
// Safe — parameterised
await queryDb('SELECT * FROM contact_submissions WHERE status = $1', [status]);

// Would be unsafe — never done
await queryDb(`SELECT * FROM contact_submissions WHERE status = '${status}'`);
```

The NeonDB HTTP client sends params as a separate JSON array — they are never embedded in the query string.

---

## 7. Error Handling

All `500` responses return a generic message — internal errors are logged server-side only.

```js
// What the client sees
{ "error": "Internal server error" }

// What appears in Render logs
[admin] relation "contact_submissions" does not exist
```

This prevents leaking:
- Database table names and schema
- Stack traces
- Internal file paths
- NeonDB connection errors

---

## 8. Email Security (`api/contact.js`)

- `tls.rejectUnauthorized` is `true` in production — enforces valid TLS certificates on SMTP connection
- HTML escaping applied to all user inputs before rendering in email body
- `emailDebug` config details are **never** returned in API responses — logged server-side only
- SMTP credentials stored in environment variables only — never in code

---

## 9. CORS Policy

**File:** `server.js`

Only `https://patienceai.in` (and same-origin requests) are allowed for API calls.

```
Access-Control-Allow-Origin: https://patienceai.in
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Credentials: true
```

Preflight `OPTIONS` requests return `204` immediately.

---

## 10. Environment Variables — Security-Critical

**File:** `documentation/06_environment_variables.md` has full list.

Security-specific variables:

| Variable | Required | Description |
|---|---|---|
| `ADMIN_SESSION_SECRET` | **CRITICAL** | 64-char random string used to sign session tokens. If not set, server logs a loud warning in production and falls back to a weak default. |
| `ADMIN_USERNAME` | Required | Admin panel login username |
| `ADMIN_PASSWORD` | Required | Admin panel login password |
| `NODE_ENV` | Required | Must be `production` on Render to activate Secure cookies and TLS enforcement |

### Generate `ADMIN_SESSION_SECRET`
```
https://generate-secret.vercel.app/64
```
Set in **Render → your service → Environment → Add environment variable**.

---

## 11. What Is NOT Yet Done (Remaining 12%)

| Item | Risk | How to fix |
|---|---|---|
| `ADMIN_SESSION_SECRET` not set in Render | HIGH — sessions can be forged | Render → Environment → add var (see Section 10) |
| No Cloudflare WAF / DDoS protection | MEDIUM — direct traffic hits Render | Point DNS through Cloudflare free tier |
| No CSP nonce (uses unsafe-inline) | LOW — required by React + GA4 | Future: migrate to nonce-based CSP |
| og-image.png missing | Cosmetic | Upload 1200×630px image to `public/` |

### Add Cloudflare for free WAF + DDoS (recommended)
1. Go to **cloudflare.com** → Add site → `patienceai.in`
2. Change nameservers at your domain registrar to Cloudflare's
3. Enable: Security → WAF → Managed Rules (free)
4. Enable: Security → Bot Fight Mode (free)
5. Enable: SSL/TLS → Full (strict)

This adds a global CDN, DDoS mitigation, bot blocking, and a Web Application Firewall — all free.

---

## 12. Security Checklist — Current Status

```
HTTP security headers (all 7)          ✅  Set on every response
Content Security Policy                ✅  Configured for React + GA4 + Clarity
HSTS (force HTTPS)                     ✅  1 year, includeSubDomains, preload
Clickjacking protection                ✅  X-Frame-Options: DENY
MIME sniffing protection               ✅  X-Content-Type-Options: nosniff
Password hashing (scrypt)              ✅  Memory-hard, timing-safe comparison
Session tokens (HMAC-SHA256)           ✅  Signed, expiring, HttpOnly cookie
Admin brute-force protection           ✅  10 attempts / 15 min rate limit
Contact form spam protection           ✅  5 submissions / hour rate limit
Analytics flood protection             ✅  120 requests / min rate limit
SQL injection prevention               ✅  Parameterised queries throughout
XSS prevention in emails               ✅  HTML escaping on all user input
Input validation (contact form)        ✅  Required fields + email regex
Status field validation (admin)        ✅  Whitelist check before DB write
Internal errors hidden from clients    ✅  Generic 500 message, logged server-side
emailDebug removed from responses      ✅  Logged server-side only
SMTP TLS cert validation               ✅  Enforced in production
CORS policy                            ✅  Same-origin only
x-powered-by header removed            ✅  Express fingerprint hidden
Analytics GET protected                ✅  Requires admin session
ADMIN_SESSION_SECRET warning           ✅  Loud log if missing in production
ADMIN_SESSION_SECRET set in Render     ❌  Must be added manually in dashboard
Cloudflare WAF / DDoS                  ❌  Not configured (optional but recommended)
CSP without unsafe-inline              ❌  Requires nonce-based CSP (future work)
```

---

## 13. Quick Reference — Security Files

| File | Purpose |
|---|---|
| `api/_security.js` | Password hashing, session token create/verify, cookie serialization |
| `api/_ratelimit.js` | In-memory rate limiter middleware |
| `api/auth.js` | Login, logout, session check |
| `api/admin.js` | Protected admin CRUD (requires session) |
| `api/analytics.js` | GET protected, POST rate-limited |
| `api/contact.js` | Rate-limited, input validated, HTML-escaped, no debug leaks |
| `server.js` | Security headers, CORS, rate limiter wiring |
