# Changelog

All notable updates to the Patience AI website, in plain language.

## June 11, 2026

### New: Support tickets
- Support executives can raise a ticket while chatting with a customer. A "Create ticket" button sits right inside the chat — it opens a small form to pick a category, a priority (low, medium, high, urgent), describe the task, attach files, and choose who should handle it.
- Tickets can only be assigned to people on the company team (a company email address is required). While typing, the most frequently chosen teammates appear as suggestions, so assigning takes one click.
- When a ticket is created, two emails go out automatically: one to the customer (using the email they shared when joining chat) confirming their request is being tracked, and one to the assigned teammate letting them know the support team has given them a task. The ticket keeps a record of whether each email was delivered.
- Executives also have a full "Tickets" workspace in their console: create tickets not tied to a chat, advanced search (by ticket number, client email, assignee, status, priority, category, or date range), saved filters, select-many bulk actions (close, change status/priority, assign in one go), and a one-click download of the ticket list as a spreadsheet.

### New: Response-time promises (SLA) and automatic escalation
- Every ticket now carries a response deadline based on its priority — urgent: 4 hours, high: 12, medium: 24, low: 72. Admins can change these rules any time.
- Tickets show a live countdown, an "almost due" warning, and a clear overdue alert when the deadline passes.
- If the assigned person doesn't respond, the system follows up on its own: first a reminder email to them, then an alert to the executive who raised the ticket, and finally to the admin. Every escalation step is recorded on the ticket.

### New: Team ticket portal
- Teammates who get assigned tickets have their own portal. Admins invite them by email; the invitation contains a link to set a password (with strength checks) and sign in.
- Each person sees only the tickets assigned to them — with filters, search and counts. They can move a ticket through its stages (open → in progress → resolved → closed), adjust priority, attach files, and chat with the support executive who raised it.
- The portal includes a notification bell, a dark/light theme switch, a change-password option, and a confirmation prompt before logging out.

### New: Customer ticket page
- Customers get a link in their confirmation email to a "Track your ticket" page. With their ticket number and email, they can see the status and full timeline, reply to the support team, upload screenshots or documents, and close the ticket themselves once they confirm it's resolved.
- Private staff notes are never shown to customers.

### New: Notifications, mentions and internal notes
- Executives and team members have a notification bell that lights up for assignments, replies, status changes, mentions, escalations and deadline warnings.
- Typing @name in a ticket conversation notifies that teammate directly.
- Any staff message can be marked as an "internal note" — visible to the team, invisible to the customer.

### New: Admin ticket operations
- A new "tickets" tab in the admin dashboard shows team performance at a glance: tickets created and closed, average resolution and first-response times, overdue tickets and missed deadlines — overall and per person, with date filtering and spreadsheet export.
- Admins manage the deadline rules, ticket categories (including custom ones) and the team's saved quick-replies from the same place.
- A knowledge base section lets admins publish articles, FAQs and troubleshooting guides. When an executive types a ticket subject, matching articles appear as suggestions — sometimes the answer already exists and no ticket is needed.
- A security log records sensitive actions (invitations, password changes, ticket deletions, reassignments, escalations) and is visible only to the admin.

### New: Admin "team" section
- The admin dashboard has a "team" tab for inviting portal members (company email addresses only), re-sending invitations, deactivating accounts, and removing people. If an invite email can't be delivered, the admin gets a link to share manually.

### Faster & lighter
- The site now keeps frequently-viewed ticket data in a fast in-memory layer (Redis), so pages stay snappy and the database does a fraction of the work it used to. A long-standing bug that quietly disabled this layer was also fixed.
- File attachments now live in cloud file storage (Cloudflare R2): any file type up to 10 MB can be attached, and downloads come straight from the storage network for speed.
- Every screen updates itself automatically — new messages, tickets, stats and team changes appear within seconds without reloading the page.

### Fixed
- The admin dashboard now always opens in light mode. The theme control that previously appeared but didn't switch properly has been removed — light mode is locked for admin, while the team portal keeps its own dark/light choice.
