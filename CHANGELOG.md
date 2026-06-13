# Changelog

All notable updates to the Patience AI website, in plain language.

## June 13, 2026

### Team portal — Overview home
- New **Overview** tab (the default landing page after login): a personal home with your profile, the team role the admin set for you (Software Developer, Engineering Manager, etc.), the permissions granted to you, and **draggable summary cards** that jump to Dev Tickets, Tickets, Engineering, GitHub, Notes, Meetings and Colleagues.
- Click your name or avatar to open a **profile editor** — change your display name and upload a profile picture. Pictures are compressed and stored on Cloudflare R2 (only a tiny reference lives in the database) and served through a cached link, so they no longer vanish.

### Calls — notes, chat, add people, mic state, floating window
- Group and meeting calls now have an in-call **Notes** sidebar (left) and a live **Chat** sidebar (right) shared by everyone in the call, plus a **Share** button that copies a public join link.
- An **Add (+)** button lets you ring another online colleague (Team / Support tabs) straight into the call, or copy the invite link.
- Each tile shows a **green mic when speaking** and a **red crossed-mic when muted**; mute state is shared live with everyone.
- **Minimize** now opens a small **draggable picture-in-picture** window that follows the active speaker — movable anywhere, hover for expand/leave.
- **Public guest meetings**: anyone can join a meeting from a shared `/meet?room=…` link with just their name — no account needed.

### Notes & meetings
- Clicking a note opens it in a dialog with full **Edit / Delete** actions.
- A meeting's **Cancel** button now actually deletes the meeting.

### GitHub workspace
- Open a repo to see its **clone URL** (copy button) and an **"Open in…"** menu that deep-links into VS Code, Cursor, JetBrains or GitHub Desktop and auto-clones onto your machine.
- New **Collaborators** tab (visible only with the new *collaborator-manage* permission): add/remove GitHub collaborators with a permission level, right from the portal.

### Deployments — per-repo, admin-managed
- Admins now configure deployment **per repository**: pick the repo from a dropdown, paste its **Render deploy hook**, optionally its **Render API key**, and tick **which team users may deploy it** — all from Admin → Deploy (no Render env editing needed).
- Team users see only the repos they're granted, pick one before deploying, and only that repo's hook fires. The **Deploy button only appears for users on the admin deployer allow-list.**
- Each repo has a **Service & environment** panel: environment variables open in a **Render-style popup** with full add/edit/remove and **Save to Render**; plus editable settings (name, branch, auto-deploy) and a deploy **history** where each entry opens a detail popup. Cancel and live logs now target the correct service.

### Support portal
- Support executives get the **same video & group-call experience** as the team (notes, chat, ring-in colleagues), cross-team and within support — only the external public share link is disabled for them.
- When a chat or call is **transferred**, the target executive gets an urgent *"customer is waiting — join fast"* email + push (whatever their status), and **all other executives are alerted** so the customer is picked up quickly.

### Security hardening
- Removed a hardcoded Render deploy-hook and a seeded support-exec password from the source; both now come from the environment and fail closed.
- Ticket/chat attachments in browser-executable formats (HTML/SVG/JS) are force-downloaded, profile images are strictly validated, and the support-exec login is rate-limited.

### Mobile
- The team portal header now wraps and the tab bar scrolls on small screens; modals and the Overview are responsive on phone and desktop.

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
