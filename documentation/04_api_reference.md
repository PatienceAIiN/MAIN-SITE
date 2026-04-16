# API Reference

Base URL: `https://patienceai.onrender.com` (production) | `http://localhost:3000` (local)

All request/response bodies are JSON. All authenticated routes require the `pa_admin_session` cookie.

---

## Authentication — `/api/auth`

### GET /api/auth
Check current session status.

**Response**
```json
{ "authenticated": true, "user": { "username": "admin" } }
// or
{ "authenticated": false }
```

### POST /api/auth
Admin login.

**Request body**
```json
{ "username": "admin", "password": "..." }
```

**Response (200 success)**
```json
{ "authenticated": true, "user": { "username": "admin" } }
```
Sets `pa_admin_session` HttpOnly cookie (7-day TTL).

**Response (401 failure)**
```json
{ "error": "Invalid credentials" }
```

### DELETE /api/auth
Logout. Clears session cookie.

**Response**
```json
{ "authenticated": false }
```

---

## Contact Form — `/api/contact`

### POST /api/contact
Submit a contact or inquiry form. Saves to DB and sends two emails.

**Request body**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Demo request",
  "message": "I'd like to see a demo...",
  "company": "Acme Inc",
  "productName": "PATIENCE Analytics",
  "source": "sales"
}
```

`source` values: `sales` | `product-demo` | `chatbot` | `job-inquiry-chat`

**Response (200 — both emails sent)**
```json
{ "message": "Email sent successfully", "emailSent": true, "userConfirmationSent": true }
```

**Response (200 — partial failure)**
```json
{
  "message": "Confirmation email sent to user, but team email failed.",
  "emailSent": false,
  "userConfirmationSent": true,
  "emailDebug": { "ownerError": "..." }
}
```

**Response (400 — validation)**
```json
{ "error": "All fields are required" }
// or
{ "error": "A valid email address is required" }
```

---

## Admin Submissions — `/api/admin`

All routes require admin session cookie.

### GET /api/admin
Fetch contact form submissions.

**Query params**

| Param | Values | Default |
|---|---|---|
| `status` | `all` \| `new` \| `reviewing` \| `replied` \| `archived` | `all` |
| `search` | free text (searches name/email/subject/message) | — |

**Response**
```json
{
  "items": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "subject": "Demo request",
      "message": "...",
      "company": "Acme",
      "product_name": null,
      "source": "sales",
      "status": "new",
      "created_at": "2026-04-17T10:00:00Z",
      "updated_at": "2026-04-17T10:00:00Z"
    }
  ],
  "counts": {
    "total": 42,
    "new": 5,
    "reviewing": 3,
    "replied": 30,
    "archived": 4
  }
}
```

### PATCH /api/admin
Update submission status.

**Request body**
```json
{ "id": 1, "status": "reviewing" }
```

`status` values: `new` | `reviewing` | `replied` | `archived`

**Response**
```json
{ "item": { ...updatedSubmission } }
```

### DELETE /api/admin
Delete a submission.

**Request body**
```json
{ "id": 1 }
```

**Response**
```json
{ "deleted": true, "id": 1 }
```

---

## AI Chat — `/api/chat`

### POST /api/chat
Send a message to the AI assistant.

**Request body**
```json
{
  "message": "What does PATIENCE AI do?",
  "sessionId": "uuid-optional",
  "conversationId": "uuid-optional",
  "history": [
    { "role": "user", "content": "previous message" },
    { "role": "assistant", "content": "previous reply" }
  ]
}
```

**Response**
```json
{
  "answer": "PATIENCE AI is an enterprise AI platform...",
  "sessionId": "abc-123",
  "conversationId": "xyz-456",
  "degraded": false
}
```

`degraded: true` means Groq was unavailable and a rule-based fallback was used.

---

## Chat Admin — `/api/chat-admin`

All routes require admin session cookie.

### GET /api/chat-admin
List all chat conversations.

**Query params**

| Param | Description |
|---|---|
| `conversationId` | Optional — fetch a single conversation's messages |

**Response (all conversations)**
```json
{
  "conversations": [
    {
      "conversationId": "xyz-456",
      "ipAddress": "1.2.3.4",
      "updatedAt": "2026-04-17T10:00:00Z",
      "messages": [...]
    }
  ]
}
```

### DELETE /api/chat-admin
Delete a message or entire conversation.

**Request body**
```json
{ "id": 5 }
// or
{ "conversationId": "xyz-456" }
```

---

## Site Content — `/api/site-content`

### GET /api/site-content
Fetch all site CMS content (public).

**Response**
```json
{
  "content": { ...fullSiteConfigObject },
  "source": "neondb"
}
```

`source` values: `neondb` | `local-fallback-missing-table` | `neondb-seeded-default`

### PATCH /api/site-content
Update site content. Requires admin session.

**Request body**
```json
{ "content": { ...updatedSiteConfigObject } }
```

**Response**
```json
{ "content": { ...updatedSiteConfigObject } }
```

### DELETE /api/site-content
Reset site content to factory defaults. Requires admin session.

**Response**
```json
{ "reset": true, "content": { ...defaultContent } }
```
