# Database Schema

**Provider:** Neon (Serverless PostgreSQL)  
**Access:** HTTP API — no persistent TCP connection required  
**Auto-migration:** Tables are created automatically on first request

---

## Connection

```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require&channel_binding=require
```

The `_db.js` module exposes a single `queryDb(sql, params)` function that POSTs to Neon's HTTP endpoint.

---

## Tables

### `admin_users`

Stores admin credentials (currently unused for auth — credentials live in env vars, but table exists for future multi-admin support).

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK, auto-increment |
| `username` | text | NOT NULL, UNIQUE |
| `password_salt` | text | NOT NULL |
| `password_hash` | text | NOT NULL |
| `created_at` | timestamptz | DEFAULT now() |
| `updated_at` | timestamptz | DEFAULT now() |

---

### `site_content`

Stores all CMS content as a single JSON blob. One row per slug.

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK, auto-increment |
| `slug` | text | NOT NULL, UNIQUE |
| `data` | jsonb | NOT NULL |
| `created_at` | timestamptz | DEFAULT now() |
| `updated_at` | timestamptz | DEFAULT now() |

**Indexes:** `site_content_slug_idx` on `slug`

**Active slug:** `'default'` — the single content record powering the whole site.

---

### `contact_submissions`

Stores every contact/demo/inquiry form submission.

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK, auto-increment |
| `name` | text | NOT NULL |
| `email` | text | NOT NULL |
| `subject` | text | NOT NULL |
| `message` | text | NOT NULL |
| `company` | text | nullable |
| `product_name` | text | nullable |
| `source` | text | NOT NULL, DEFAULT `'sales'` |
| `status` | text | NOT NULL, DEFAULT `'new'` |
| `created_at` | timestamptz | DEFAULT now() |
| `updated_at` | timestamptz | DEFAULT now() |

**Indexes:**
- `contact_submissions_status_idx` on `status`
- `contact_submissions_created_at_idx` on `created_at DESC`

**`source` values:**
- `sales` — standard contact form
- `product-demo` — demo request modal
- `chatbot` — submitted via AI chat
- `job-inquiry-chat` — careers/hiring enquiry

**`status` values:**
- `new` — unread
- `reviewing` — being handled
- `replied` — response sent
- `archived` — closed

---

### `chatbot_messages`

Stores all AI chat messages for admin review and context.

| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK, auto-increment |
| `session_id` | text | NOT NULL |
| `conversation_id` | text | nullable |
| `role` | text | NOT NULL, CHECK IN (`'user'`, `'assistant'`) |
| `message` | text | NOT NULL |
| `ip_address` | text | nullable |
| `created_at` | timestamptz | DEFAULT now() |

**Indexes:**
- `chatbot_messages_session_id_idx` on `session_id`
- `chatbot_messages_conversation_id_idx` on `conversation_id`
- `chatbot_messages_created_at_idx` on `created_at DESC`

**Session vs Conversation:**
- `session_id` — browser session (persisted in localStorage, unique per device)
- `conversation_id` — logical conversation thread (can start a new one mid-session)

---

## Error Handling

Missing table errors are caught and handled gracefully:

```javascript
// _db.js
export const isMissingTableError = (message) =>
  /relation .* does not exist/i.test(message);
```

Non-critical operations (chat logging, contact insert) silently skip on DB error so the user-facing response always completes.

---

## Neon HTTP API Pattern

```javascript
// How every query runs — no pg driver, no connection pool
const res = await fetch(`https://${neonHost}/sql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Neon-Connection-String': process.env.DATABASE_URL
  },
  body: JSON.stringify({
    query: 'SELECT * FROM contact_submissions WHERE status = $1',
    params: ['new']
  })
});
const { rows } = await res.json();
```

---

## June 2026 schema additions

- **`team_members.avatar`** (text) — profile picture: a Cloudflare R2 object key (preferred) or a legacy base64 data URL.
- **`deploy_targets`** — per-repo deploy config: `id, label, repo, deploy_hook, api_key, allowed_emails (csv), created_at, updated_at`. `api_key` lets a repo's Render service load even in another account; `allowed_emails` = which team users may deploy it (empty = all deploy-allowed users).
- **`deploys.target_id` / `deploys.target_label`** — link each deploy/schedule row to its `deploy_targets` entry so history, cancel and logs are scoped per repo.
- All added idempotently via `ALTER TABLE … ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` in `ensureSchema`.
