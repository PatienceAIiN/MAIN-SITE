# Ticketing & Support Operations — Architecture

The ticketing subsystem turns live-support conversations into trackable work items with SLAs, escalation, notifications, file attachments and a client-facing portal. It is designed around three principles:

1. **Postgres is the system of record, Redis absorbs the read traffic.** Every UI surface polls; none of that polling should reach Neon.
2. **Cloudflare R2 owns file bytes.** The database stores only attachment metadata; downloads stream directly from R2 via presigned URLs.
3. **Graceful degradation.** If Redis is down, every read transparently falls through to Postgres. If R2 is unconfigured, small attachments (≤ 3 MB) fall back to base64-in-Postgres. Nothing hard-fails.

---

## 1. Roles & Access Model

| Role | Session cookie | Scope |
|---|---|---|
| **Admin** | `pa_admin_session` | Everything: all tickets, settings (SLA/categories/saved responses), knowledge base, audit logs, performance dashboard, team & executive management |
| **Support executive** | `pa_exec_session` | Create/view/update/delete any ticket, bulk operations, reassign, internal notes, CSV export |
| **Team member** (assignee) | `pa_member_session` | Only tickets where `assignee_email` = their email; can change status/priority, comment, attach files. Cannot reassign, cannot see others' tickets, no audit access |
| **Client** (no account) | — | Proves ownership with ticket key (`PA-n`) + the email captured at chat join. Sees status + public timeline only — internal notes and staff identities are never exposed |

All three staff session types are HMAC-SHA256 signed tokens (7-day expiry) sharing `api/_security.js`. Assignment is restricted to `@patienceai.in` addresses, enforced server-side.

## 2. Data Model (Neon Postgres)

```
support_tickets        — work item: subject, description, category, priority, status,
                         assignee, client linkage (conversation_id, customer_email),
                         SLA fields (due_at, first_response_at, resolved_at,
                         sla_warned, sla_breached), escalation_level, email delivery
                         statuses (client_email_status, assignee_email_status)
ticket_comments        — timeline: roles executive|member|admin|client|system,
                         is_internal flag (never served to clients)
ticket_attachments     — metadata only: file_name, content_type, size_bytes,
                         storage ('r2'|'db'), r2_key; data_base64 used only as the
                         no-R2 fallback
ticket_escalations     — escalation ladder history (level, reason, notified_email)
notifications          — per-recipient feed ('admin' is the admin pseudo-recipient)
audit_logs             — sensitive actions (admin-only read)
team_members           — portal accounts (invite → activate → active/inactive)
sla_policies           — hours per priority (urgent 4 / high 12 / medium 24 / low 72)
ticket_categories      — 7 defaults + admin-defined
kb_articles            — knowledge base (article|faq|guide), keyword search
saved_responses        — canned replies for staff
```

Schema is migrated idempotently at boot (`SCHEMA_QUERIES` in `api/_db.js`). Defaults (SLA rows, categories, saved responses) are seeded once by `ensureTicketingSeeds()`.

## 3. Read Path — Redis Caching Strategy

**Problem.** Every surface polls: executive ticket list (10s), ticket detail (4s), member portal (8s), client page (6s), notification bells (15s), settings on each modal open. Unmitigated, a handful of open tabs generates thousands of Neon round-trips per hour.

**Design — version-stamped keys** (`api/_cache.js`):

- Each scope has a monotonic version counter in Redis: `ver:tickets` (any ticket changed) and `ver:ticket:{id}` (one ticket's timeline).
- Read keys embed the version: `cache:tix:list:{ver}:{scope}:{md5(filters)}`, `cache:tix:one:{id}:{ver}`, `cache:tix:client:{id}:{ver}:{md5(email)}`.
- **Every write bumps the counter** (`INCR`) — create, status/priority change, reassign, comment, attachment, escalation sweep, client reply/close. The next poll computes a new key, misses, and reads fresh data; superseded entries simply expire via TTL (15–30s). No wildcard invalidation needed.
- Point caches with explicit `DEL` invalidation: notifications per recipient (dropped inside `notify()`), ticket settings (dropped on any admin settings write).
- The client-portal cache key includes an MD5 of the requester's email, so a wrong-email probe can never be served another caller's payload.

**Measured result** (local, `DB_QUERY_LOG=1`): 36 consecutive polled requests across list/detail/notifications/settings with a warm cache → **0 Postgres queries**; a write is visible on the very next read.

**Failure mode.** `cached()` swallows all Redis errors and runs the producer — a Redis outage degrades to direct Neon reads, never an error. The Redis client itself (`api/_redis.js`) is a dependency-free RESP implementation over **one persistent pipelined connection** (the previous per-command-connection client also mis-parsed bulk strings containing `:`/`$`, which silently disabled all cache hits — fixed and covered by round-trip tests including 1 MB payloads).

## 4. File Attachments — Cloudflare R2

- **Limit: 10 MB per file, any format.** Enforced client-side, at the Express body parser (`413`), and in the handler.
- **Upload**: `POST /api/attachments/upload?ticketId&fileName[&clientEmail]` with the raw file bytes as the request body (`Content-Type` = the file's MIME type). The server streams it to R2 under an unguessable key `tickets/{ticketId}/{ts}-{random}-{name}` and records metadata in Postgres. No bucket CORS configuration is required because browsers never talk to R2 directly for uploads.
- **Download**: `GET /api/attachments?id=N[&email=...]` performs the access check, then `302`-redirects to a **15-minute presigned R2 URL** — file bytes never transit the app server or Postgres.
- **Access control** mirrors comments: staff by session (members only their tickets), clients by ticket + matching customer email.
- **Fallback**: without R2 credentials the system stores base64 in Postgres, capped at 3 MB, so dev environments still work.

## 5. SLA & Escalation Engine

`api/_escalation.js`, swept every 5 minutes from `server.js`:

- `due_at` = `created_at` + SLA hours for the priority (recomputed when priority changes). Admin edits SLA hours in the admin → tickets tab.
- **Warning** notification when a ticket is within `TICKET_SLA_WARNING_HOURS` (default 2h) of its deadline; **breach** notification (assignee + admin) plus a timeline entry when it passes.
- **No-response ladder** (ticket has no `first_response_at` from the assignee): after `TICKET_REMINDER_HOURS` (default 2h) per step — L1 reminder email to assignee → L2 escalation to the raising executive → L3 escalation to admin (`CONTACT_TO_EMAIL`). Each step is recorded in `ticket_escalations` and on the ticket timeline.
- The clock stops when the assignee posts their first comment (`first_response_at`).

## 6. Notifications & Mentions

`notify(recipient, type, ticketId, message)` writes a row and drops that recipient's cache. Types: `assignment`, `reassignment`, `status_change`, `comment`, `mention`, `escalation`, `sla_warning`, `sla_breach`. `@name` in any comment resolves against active executives + team members and notifies the match. Bells poll `GET /api/notifications` (cache-served); opening the bell marks all read.

## 7. API Surface (new endpoints)

```
/api/tickets               GET (advanced filters / ?id= / ?suggest=1 / ?export=csv)
                           POST create · PATCH single-or-bulk {ids:[]} · DELETE
/api/tickets/comments      POST (isInternal flag)
/api/attachments/upload    POST raw bytes (≤10 MB, any format) → R2
/api/attachments           GET ?id= (302 → presigned R2) · GET ?ticketId= (metadata)
/api/client-tickets        GET/POST — public, rate-limited, key+email proof
/api/team-members          login/activate/me/logout/change-password + admin CRUD
/api/notifications         GET · PATCH mark-read
/api/ticket-settings       GET · admin PATCH sla / POST category|response / DELETE
/api/ticket-stats          GET totals+per-assignee (?export=csv) · ?audit=1 (admin)
/api/kb                    GET ?search= · admin POST/PATCH/DELETE
```

Email side-effects (Brevo/SMTP via `api/_email.js`): client confirmation with a `/my-ticket` link, assignee notification, escalation reminders, team-member invites. Delivery outcomes are persisted per ticket (`sent`/`failed`/`skipped`) — a mail outage never blocks ticket creation.

## 8. Extension Points (future-ready)

- **Channels** (WhatsApp etc.): tickets already carry `conversation_id` + `customer_email`; a new channel only needs to create a conversation and call `POST /api/tickets`.
- **AI auto-assignment / summaries / suggested replies**: subject + description + `ticket_comments` timeline provide the full prompt context; assignment is a single `PATCH`.
- **CSAT**: add a `ticket_ratings` table keyed by ticket + client email; the client portal close-flow is the natural collection point.
- **Multi-team**: add `team` column to `team_members` and a team filter on the list endpoint — the version-stamped cache keys already namespace by filter hash.

---

## 9. PEOS — Engineering Operating System (June 2026)

Tickets remain the central entity; PEOS layers engineering ops on top via `/api/peos` (RBAC by existing roles) and the admin **engineering** tab:

- **Sprints & epics**: tickets gain `sprint_id`, `epic_id`, `story_points`, `ticket_type`; sprint board (`?sprintBoard=ID`); velocity feeds the dashboard.
- **Incidents** (SEV-1..4, investigate→resolve→postmortem→close), **service catalog** (owner/backup/repo/runbook/SLA/dependencies — doubles as API & architecture registry), **OKRs** (company→department→team→sprint), **announcements**.
- **Executive dashboard** (`?dashboard=1`): health score, open/overdue/breaches, critical incidents, sprint velocity.
- **Universal search** (`?search=`): tickets, incidents, services, epics, docs, people, GitHub links.
- **GitHub**: webhook `/api/github-webhook` (HMAC `GITHUB_WEBHOOK_SECRET`). Branches/commits/PRs/releases mentioning `PA-<n>` auto-link, post timeline entries, notify the assignee, and advance workflow: branch/commit/PR-open → in_progress, PR merged → resolved.
- **AI copilot**: provider-abstracted `api/_ai.js` (Groq default; Anthropic/OpenAI via `AI_PROVIDER`); ticket summaries `?summarize=PA-n`.

Backward compatible: no existing API/table changed shape; new columns are additive with defaults.
