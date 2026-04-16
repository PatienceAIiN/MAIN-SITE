# System Design — HLD & LLD

## High-Level Design (HLD)

```
                        ┌─────────────────────────────────────────┐
                        │              INTERNET / USER             │
                        └────────────────────┬────────────────────┘
                                             │ HTTPS
                        ┌────────────────────▼────────────────────┐
                        │          RENDER WEB SERVICE              │
                        │         patienceai.onrender.com          │
                        │                                          │
                        │  ┌──────────────────────────────────┐   │
                        │  │         Express.js Server         │   │
                        │  │           (Node.js 24)            │   │
                        │  │                                   │   │
                        │  │  /api/*   ──► API Route Handlers  │   │
                        │  │  GET *    ──► dist/index.html     │   │
                        │  └──────────────────────────────────┘   │
                        └────┬──────────────┬──────────┬──────────┘
                             │              │          │
               ┌─────────────▼──┐  ┌────────▼──┐  ┌───▼─────────┐
               │ Neon PostgreSQL │  │ Groq API  │  │ GoDaddy SMTP│
               │  (Serverless)   │  │ (LLaMA)   │  │ (port 465)  │
               └────────────────┘  └───────────┘  └─────────────┘
```

## Request Flow — Page Load

```
Browser
  │
  ├─ GET https://patienceai.in/
  │     └─ Express: serve dist/index.html
  │
  ├─ React app boots, BrowserRouter renders <App>
  │
  ├─ GET /api/site-content  (every 4s polling)
  │     └─ Express → site-content.js
  │           └─ Neon: SELECT data FROM site_content WHERE slug='default'
  │                 └─ Returns JSON config → React re-renders with content
  │
  └─ UI fully interactive
```

## Request Flow — Contact Form Submission

```
User fills form → clicks Submit
  │
  ├─ POST /api/contact  { name, email, subject, message, source }
  │
  └─ contact.js handler:
        │
        ├─ 1. Validate required fields + email format
        │
        ├─ 2. INSERT into contact_submissions (Neon)
        │         └─ If DB unavailable → silently skip (non-blocking)
        │
        ├─ 3. Validate SMTP env vars
        │
        ├─ 4. nodemailer.sendMail() → GoDaddy SMTP → Owner notification email
        │         From: growth@patienceai.in
        │         To:   support@patienceai.in
        │         ReplyTo: user's email
        │
        ├─ 5. nodemailer.sendMail() → GoDaddy SMTP → User confirmation email
        │         From: growth@patienceai.in
        │         To:   user's email
        │
        └─ 6. Return JSON { emailSent, userConfirmationSent, message }
```

## Request Flow — AI Chat

```
User types message → sends
  │
  ├─ POST /api/chat  { message, sessionId, conversationId, history }
  │
  └─ chat.js handler:
        │
        ├─ 1. Filter hardcoded topics (dev/coding/sensitive → static reply)
        │
        ├─ 2. Load site content from Neon (or fallback JSON)
        │
        ├─ 3. Flatten site content → searchable text chunks
        │
        ├─ 4. Semantic keyword match against user message
        │
        ├─ 5. Build system prompt with matched content context
        │
        ├─ 6. POST to Groq API (LLaMA-3.3-70B)
        │         If Groq fails → degraded mode (rule-based fallback)
        │
        ├─ 7. INSERT message + response into chatbot_messages (Neon)
        │
        └─ 8. Return { answer, sessionId, conversationId, degraded? }
```

## Request Flow — Admin Authentication

```
Admin navigates to /admin
  │
  ├─ React renders AdminPage
  │
  ├─ GET /api/auth  (check session cookie)
  │     └─ auth.js: validate pa_admin_session HMAC token
  │           ├─ Valid → { authenticated: true, user }
  │           └─ Invalid → { authenticated: false }
  │
  ├─ If not authenticated → show login form
  │
  └─ POST /api/auth  { username, password }
        └─ auth.js:
              ├─ Timing-safe compare credentials vs env vars
              ├─ Generate HMAC-SHA256 signed session token
              └─ Set HttpOnly cookie (7-day TTL)
```

---

## Low-Level Design (LLD)

### Component Tree

```
App.jsx
├── Navbar
│   ├── ContentLink (× n nav items)
│   └── HamburgerIcon
│
├── Routes
│   ├── / → HomePage
│   │   ├── Hero
│   │   ├── BigStatement
│   │   ├── Features
│   │   ├── Possibilities
│   │   └── CTABanner
│   │
│   ├── /products → ProductsPage
│   ├── /platform → PlatformPage
│   ├── /company/blog → BlogPage
│   ├── /company/blog/:slug → BlogPostPage
│   ├── /company/careers → CareersPage
│   ├── /admin → AdminPage (separate layout)
│   └── /:detailPath → DetailPage (dynamic)
│
├── Footer
├── ContactUs (modal, global)
├── ProductDemoModal (modal, global)
└── ChatWidget (floating, global)
```

### State Management

No global state library (Redux/Zustand). State is managed via:

| State | Location | Method |
|---|---|---|
| Site content (CMS) | `App.jsx` | `useState` + polling `useEffect` |
| Current route | React Router | `useLocation` / `useNavigate` |
| Modal open/close | `App.jsx` | `useState` (passed as props) |
| Chat messages | `ChatWidget.jsx` | `useState` + localStorage (IDs) |
| Mobile menu | `Navbar.jsx` | `useState` |
| Admin data | `AdminPage.jsx` | `useState` + fetch on mount |
| Form submission | Each form component | `useState` (idle/submitting/success/error) |

### Database Access Pattern

All DB calls use Neon's HTTP SQL API — no persistent TCP connection:

```javascript
// _db.js pattern
const response = await fetch(`https://${host}/sql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Neon-Connection-String': process.env.DATABASE_URL
  },
  body: JSON.stringify({ query: 'SELECT...', params: [...] })
});
```

Tables are **auto-created** on first use (no migration runner needed). Missing table errors are caught and silently skipped for non-critical operations like chat logging.

### Session / Auth Design

```
Login:
  HMAC-SHA256(username + expires_at, ADMIN_SESSION_SECRET)
  → base64 token stored in HttpOnly cookie

Verify:
  Split token → re-compute HMAC → timing-safe compare
  → Check expiry timestamp
  → Reject if tampered or expired
```

Password stored in environment variable only — never in the database (simple single-admin setup).

### Email Architecture

```
nodemailer.createTransport({
  host: SMTP_HOST,       // smtpout.secureserver.net
  port: 465,
  secure: true,          // SSL
  auth: { user, pass }
})

Two emails per submission:
  1. Owner notification → support@patienceai.in
     - Full form data in branded HTML template
     - ReplyTo: form submitter's email

  2. User confirmation → submitter's email
     - Submission copy in branded HTML template
     - ReplyTo: growth@patienceai.in
```

### Content CMS Design

All site text/images are stored as a single JSONB blob in Neon (`site_content` table, `slug='default'`). The admin panel provides a live editor that PATCH-es this blob. The frontend polls `/api/site-content` every 4 seconds and re-renders with updated content — no page reload needed.

Fallback chain:
```
Neon available + data → return DB content
Neon available + empty → seed with default JSON → return seeded content
Neon unavailable → return hardcoded default JSON (in-process)
```
