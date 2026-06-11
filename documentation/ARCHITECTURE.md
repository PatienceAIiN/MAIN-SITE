# PatienceAI Platform — Full Architecture (Mermaid)

All diagrams render on GitHub. Source of truth: `server.js`, `api/*`, `src/pages/*`, `src/components/*`.

## 1. System Overview

```mermaid
flowchart TB
    subgraph Clients["Browsers (React 18 + Vite)"]
        PUB["Public site /\n+ AI chat widget"]
        CLI["Client portal /my-ticket\n(key + email, no login)"]
        TEAM["Team portal /team\nTickets · Engineering · GitHub · Colleagues"]
        EXEC["Support portal /support-executive\nLive chats · Tickets · Colleagues"]
        ADM["Admin /admin\nRoster · Grants · PEOS · Logs"]
    end

    subgraph Server["Express (server.js, single Node process)"]
        MW["Middleware: HTTPS redirect · security headers\nrevocation check · rate limits · body caps"]
        API["/api/* route handlers (api/*.js)"]
        HUB["WS hub /ws/team (api/_teamhub.js)\npresence · chat fan-out · typing\nperms push · WebRTC signaling"]
        SWEEP["Escalation/SLA sweep (5 min)"]
    end

    subgraph Data["State"]
        PG[("Neon Postgres\n(HTTP SQL API)")]
        RD[("Redis\ncache · revocation")]
        R2[("Cloudflare R2\nticket attachments")]
    end

    subgraph Ext["External services"]
        GH["GitHub API + webhook"]
        BREVO["Brevo / SMTP email"]
        GROQ["Groq LLM (AI summaries, chat)"]
        PUSHSVC["Browser push services\n(web-push, VAPID)"]
        TURN["STUN/TURN (calls)"]
    end

    Clients -->|HTTPS JSON| MW --> API
    TEAM & EXEC <-->|WebSocket| HUB
    API --> PG & RD
    API -->|presigned 302| R2
    API --> GH & BREVO & GROQ
    API & HUB --> PUSHSVC
    TEAM & EXEC <-->|"WebRTC media (P2P)"| TURN
    SWEEP --> PG & BREVO
    GH -->|"webhook PA-n auto-link"| API
```

## 2. Sessions, Roles & Authorization

```mermaid
flowchart LR
    subgraph Cookies["HMAC-SHA256 signed cookies (HttpOnly, SameSite=Lax, 7d)"]
        A["pa_admin_session"]
        M["pa_member_session"]
        E["pa_exec_session"]
        MK["pa_mkt_session"]
    end

    A --> ADMIN["Admin: everything"]
    M --> ROLES{"team_role"}
    E --> EXECR["Executive: all tickets,\ncustomer chats, colleagues"]

    ROLES --> DEV["software_dev\ndev_complete → QA"]
    ROLES --> TL["team_lead\nassign devs"]
    ROLES --> EM2["engineering_manager\nEM approve + roster manage"]
    ROLES --> PM["product_manager\nPM approve"]
    ROLES --> QA2["qa\nqa approve/reject"]

    subgraph Gates["Server-side gates (every request)"]
        REV["Redis revoked:member/exec → 401 instantly"]
        PERMS["permissions csv (github_read/write, roster_manage)\nNULL → role defaults"]
        REPOS["allowed_repos csv — members see ONLY granted repos\n(member cookie beats exec cookie)"]
        MEMB["chat/file access = membership in team_chats.members"]
    end
    M & E --> REV
    ROLES --> PERMS --> REPOS
    M & E --> MEMB
```

## 3. Data Model (core tables)

```mermaid
erDiagram
    team_members ||--o{ support_tickets : "assignee_email"
    support_executives ||--o{ support_tickets : "created_by"
    support_tickets ||--o{ ticket_comments : "timeline"
    support_tickets ||--o{ ticket_attachments : "files (R2/db)"
    support_tickets ||--o{ ticket_escalations : "ladder"
    support_tickets ||--o{ ticket_github_links : "PA-n autolink"
    support_tickets }o--|| sprints : "sprint_id"
    support_tickets }o--|| epics : "epic_id"
    support_tickets ||--o{ qa_test_cases : ""
    team_chats ||--o{ team_chat_messages : ""
    team_chat_messages ||--o| team_chat_files : "base64 ≤10MB"
    team_chat_messages ||--o| team_chat_messages : "reply_to snapshot"
    push_subscriptions }o--|| team_members : "by email (execs too)"
    notifications }o--|| team_members : "recipient_email"
    audit_logs ||--|| audit_logs : "logins, perms, github, deletes"

    team_members {
        text email PK
        text team_role
        text permissions "csv or NULL=role default"
        text allowed_repos "csv repo grants"
        bool notifications_enabled
        timestamptz last_seen_at
    }
    team_chats {
        text kind "dm|group"
        text members "csv emails (privacy boundary)"
    }
    support_tickets {
        text status "open..closed"
        text stage "support→pm→em→lead→dev→qa→done"
        timestamptz due_at "SLA"
        bool sla_breached
        int csat "client 1-5"
    }
```

## 4. Ticket Lifecycle & Engineering Workflow

```mermaid
stateDiagram-v2
    [*] --> support: exec creates ticket\n(SLA due_at = created + hours[priority])
    support --> pm_review: escalate → Engineering
    pm_review --> em_review: pm_approve (PM)
    pm_review --> support: pm_reject + comment
    em_review --> lead_triage: em_approve (EM)
    em_review --> support: em_reject
    lead_triage --> dev: lead_assign(dev) — least-loaded routing
    dev --> qa: dev_complete (dev)
    qa --> done: qa_approve (QA)
    qa --> dev: qa_reject + what to improve
    done --> [*]

    note right of support
        Parallel: status open/in_progress/resolved/closed
        SLA sweep (5 min) — warning → breach
        No-response ladder L1 assignee → L2 raiser → L3 admin
        Client portal: reply, files, confirm-close, CSAT 1–5★
    end note
```

## 5. Colleagues Realtime (chat · presence · files)

```mermaid
sequenceDiagram
    participant A as Member/Exec A
    participant H as WS Hub (/ws/team)
    participant API as /api/colleagues
    participant PG as Postgres
    participant P as web-push

    A->>H: connect (cookie verified: member OR exec)
    H-->>A: presence snapshot {email: online|away|offline}
    Note over H: activity ping >10 min silent → away;<br/>disconnect → offline + last_seen_at write

    A->>API: POST send {chatId, message, replyTo?}
    API->>PG: INSERT team_chat_messages (reply snapshot)
    API->>H: broadcastToEmails(chat members)
    H-->>A: {type:chat, message} (all open tabs)
    API->>P: push to members w/o open socket<br/>(unless notifications_enabled=false)

    A->>API: POST /upload raw ≤10MB
    API->>PG: message + team_chat_files(base64)
    Note over API: GET ?file=id → membership check;<br/>html/svg ⇒ attachment+octet-stream (XSS guard)
```

## 6. Voice/Video Call Signaling (WebRTC)

```mermaid
sequenceDiagram
    participant C as Caller
    participant H as WS Hub
    participant E as Callee
    participant T as STUN/TURN

    C->>C: getUserMedia(video? audio)
    C->>H: rtc {to, offer, video:bool}
    alt callee offline
        H->>E: web-push "Incoming call"
    end
    H->>E: rtc offer → ring modal (accept/decline)
    E->>H: rtc answer
    H->>C: answer
    C-->>H: ice candidates
    H-->>E: relay (and reverse)
    C<<->>E: P2P media via T (mute · cam · screen share via replaceTrack)
    C->>H: rtc hangup → cleanup both sides
```

## 7. Admin Grant Propagation & GitHub Gating

```mermaid
sequenceDiagram
    participant AD as Admin panel
    participant API as /api/team-members PATCH
    participant H as WS Hub
    participant U as Member portal (open tab)
    participant GH as /api/github

    AD->>API: {id, allowedRepos:[...]} (admin/EM only)
    API->>H: broadcastToEmails([member], perms_updated)
    H->>U: perms_updated → refetch /me + repos
    Note over U: GitHub tab + repo list update instantly;<br/>8s poll self-heals if WS missed;<br/>open revoked repo is cleared
    U->>GH: repos=1 / branches / PR actions
    GH-->>U: filtered to allowed_repos; non-granted → 403
```

## 8. Read Path — Redis Cache (why polling is cheap)

```mermaid
flowchart LR
    POLL["UI polls (4–15s):\ntickets · detail · notifications"] --> K{"cache key\ncache:tix:list:{ver}:{filters}"}
    K -- hit --> RD[("Redis (TTL 15–30s)")]
    K -- miss --> PG[("Postgres")] --> RD
    W["ANY write\n(create/comment/status/escalation)"] -->|INCR ver:tickets| VER["version counter"] -.->|new key next poll| K
    RDOWN["Redis down?"] -. fallthrough .-> PG
```

## 9. Deployment & Boot

```mermaid
flowchart TB
    GIT["git push main"] --> RENDER["Render web service\nnpm run build → node server.js"]
    RENDER --> BOOT["Boot: idempotent SCHEMA_QUERIES migrate\n· seed exec/SLA/categories · attach WS hub\n· refuse default secrets in production\n· escalation sweep timer"]
    BOOT --> ONE["Single process serves:\nstatic dist + SEO injection · /api/* · /ws/team"]
    DEV["Local: npm run dev\nVite :5173 ⇆ proxy /api + /ws → Express :PORT"]
```
