// OpenAPI 3 contract for the ticketing + PEOS surface, served at /api/openapi.json.
// Kept as a hand-maintained literal: small, dependency-free, always deployable.
const op = (summary, tag, extra = {}) => ({ get: { summary, tags: [tag], responses: { 200: { description: 'OK' } }, ...extra } });

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'PatienceAI Engineering OS API',
    version: '1.0.0',
    description: 'Tickets are the central entity. Cookie-based sessions (admin / executive / member); clients authenticate per-ticket with key+email. All list endpoints support filtering via query params.'
  },
  tags: [
    { name: 'Tickets' }, { name: 'PEOS' }, { name: 'GitHub' }, { name: 'Team' }, { name: 'Client' }
  ],
  paths: {
    '/api/tickets': {
      get: { summary: 'List tickets (filters: status, priority, category, assignee, clientEmail, dateFrom, dateTo, ticketId, search; ?id= single; ?suggest=1 assignees; ?export=csv)', tags: ['Tickets'], responses: { 200: { description: 'OK' } } },
      post: { summary: 'Create ticket (executive/admin)', tags: ['Tickets'], responses: { 200: { description: 'Created' } } },
      patch: { summary: 'Update status/priority/assignee — single {id} or bulk {ids:[]}', tags: ['Tickets'], responses: { 200: { description: 'Updated' } } },
      delete: { summary: 'Delete ticket (staff)', tags: ['Tickets'], responses: { 200: { description: 'Deleted' } } }
    },
    '/api/tickets/comments': { post: { summary: 'Comment / internal note {ticketId, message, isInternal}', tags: ['Tickets'], responses: { 200: { description: 'OK' } } } },
    '/api/attachments/upload': { post: { summary: 'Raw file body upload, ≤10 MB any format → R2 (?ticketId&fileName[&clientEmail])', tags: ['Tickets'], responses: { 200: { description: 'OK' }, 413: { description: 'Too large' } } } },
    '/api/attachments': op('Download (?id= → 302 presigned R2) or list (?ticketId=)', 'Tickets'),
    '/api/client-tickets': {
      get: { summary: 'Client view: ?key=PA-n&email= (public timeline, no internal notes)', tags: ['Client'], responses: { 200: { description: 'OK' } } },
      post: { summary: 'Client reply {key,email,message} or close {key,email,action:"close"}', tags: ['Client'], responses: { 200: { description: 'OK' } } }
    },
    '/api/notifications': {
      get: { summary: 'Notification feed + unread count', tags: ['Team'], responses: { 200: { description: 'OK' } } },
      patch: { summary: 'Mark read {ids:[]} or {all:true}', tags: ['Team'], responses: { 200: { description: 'OK' } } }
    },
    '/api/ticket-settings': op('SLA rules, categories, saved responses (admin writes via PATCH/POST/DELETE)', 'Tickets'),
    '/api/ticket-stats': op('Performance dashboard (?dateFrom&dateTo, ?export=csv) · ?audit=1 admin audit log', 'Tickets'),
    '/api/kb': op('Knowledge base list/search (?search=); admin POST/PATCH/DELETE', 'PEOS'),
    '/api/team-members': op('Portal accounts: /login /activate /me /logout /change-password + admin CRUD', 'Team'),
    '/api/peos': {
      get: { summary: 'PEOS: ?resource=epics|sprints|incidents|services|okrs|announcements|testcases · ?dashboard=1 · ?search= · ?sprintBoard=ID · ?githubFor=ID · ?summarize=PA-n (AI)', tags: ['PEOS'], responses: { 200: { description: 'OK' } } },
      post: { summary: 'Create resource item', tags: ['PEOS'], responses: { 200: { description: 'OK' } } },
      patch: { summary: 'Update resource item {id,...} · ?ticket=PA-n plan {sprintId,epicId,storyPoints}', tags: ['PEOS'], responses: { 200: { description: 'OK' } } },
      delete: { summary: 'Delete resource item (admin)', tags: ['PEOS'], responses: { 200: { description: 'OK' } } }
    },
    '/api/github': {
      get: { summary: '?status=1 · ?repos=1 · ?branches=1&owner&repo · ?prs=1&state= · ?commits=1', tags: ['GitHub'], responses: { 200: { description: 'OK' }, 503: { description: 'GITHUB_TOKEN not configured' } } },
      post: { summary: 'Actions: create_branch {branch,from} · merge_pr {number} · close_pr {number} · request_review {number,reviewers}', tags: ['GitHub'], responses: { 200: { description: 'OK' } } }
    },
    '/api/dev-workflow': {
      get: { summary: 'Engineering pipeline (?bucket=1 my items) — stages support→pm_review→em_review→lead_triage→dev→qa→done', tags: ['PEOS'], responses: { 200: { description: 'OK' } } },
      post: { summary: 'Transitions {ticketId, action: escalate|pm_approve|pm_reject|em_approve|em_reject|lead_assign|dev_complete|qa_approve|qa_reject, comment?, assigneeEmail?} — role-gated', tags: ['PEOS'], responses: { 200: { description: 'OK' } } }
    },
    '/api/github-webhook': { post: { summary: 'GitHub webhook (push/pull_request/release) — PA-n auto-linking + workflow progression', tags: ['GitHub'], responses: { 200: { description: 'OK' } } } }
  }
};
