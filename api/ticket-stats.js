// Team performance dashboard + audit log access.
// Stats: admin + executives. Audit logs (?audit=1): admin only.
import { queryDb, isMissingTableError } from './_db.js';
import { getCookieValue, SESSION_COOKIE_NAME, verifySessionToken, getExecSession } from './_security.js';

const isAdmin = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));
const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default async function handler(req, res) {
  const admin = isAdmin(req);
  const exec = getExecSession(req);
  if (!admin && !exec) return res.status(401).json({ error: 'Not authenticated' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // ── Audit / security logs (admin only) — JSON, XLSX or PDF report ─────────
  if (req.query.audit === '1') {
    if (!admin) return res.status(403).json({ error: 'Admin only' });
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 500, 5000);
      const rows = await queryDb(
        `SELECT actor_role, actor_email, action, target, metadata, created_at
         FROM audit_logs ORDER BY created_at DESC LIMIT ${limit}`
      );

      if (req.query.format === 'xlsx') {
        const XLSX = (await import('xlsx')).default;
        const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
          Time: new Date(r.created_at).toISOString(), Role: r.actor_role || '', Actor: r.actor_email || '',
          Action: r.action, Target: r.target || '',
          Details: r.metadata ? (typeof r.metadata === 'string' ? r.metadata : JSON.stringify(r.metadata)) : ''
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Security & Audit Log');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="security-audit-log.xlsx"');
        return res.status(200).send(buf);
      }

      if (req.query.format === 'pdf') {
        const PDFDocument = (await import('pdfkit')).default;
        const doc = new PDFDocument({ margin: 36, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="security-audit-report.pdf"');
        doc.pipe(res);
        doc.fontSize(16).text('Patience AI — Security & Audit Report', { align: 'center' });
        doc.fontSize(9).fillColor('#64748b').text(`Generated ${new Date().toUTCString()} · ${rows.length} events`, { align: 'center' });
        doc.moveDown();
        for (const r of rows) {
          doc.fillColor('#0f172a').fontSize(9)
            .text(`${new Date(r.created_at).toISOString()}  [${r.actor_role || '-'}] ${r.actor_email || '-'}`, { continued: false });
          doc.fillColor('#334155').fontSize(9)
            .text(`  ${r.action}${r.target ? ` → ${r.target}` : ''}${r.metadata ? `  ${typeof r.metadata === 'string' ? r.metadata : JSON.stringify(r.metadata)}` : ''}`);
          doc.moveDown(0.3);
          if (doc.y > 760) doc.addPage();
        }
        doc.end();
        return;
      }

      return res.status(200).json({ logs: rows });
    } catch (err) {
      if (isMissingTableError(err.message)) return res.status(200).json({ logs: [] });
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Performance stats (optionally filtered by date range) ─────────────────
  const { dateFrom, dateTo } = req.query;
  const where = [];
  const params = [];
  if (dateFrom) { params.push(new Date(dateFrom).toISOString()); where.push(`created_at >= $${params.length}`); }
  if (dateTo) { params.push(new Date(`${dateTo}T23:59:59`).toISOString()); where.push(`created_at <= $${params.length}`); }
  const range = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [totals, perAssignee] = await Promise.all([
      queryDb(
        `SELECT
           count(*)::int AS created,
           count(*) FILTER (WHERE status IN ('resolved','closed'))::int AS closed,
           count(*) FILTER (WHERE status IN ('open','in_progress'))::int AS open,
           count(*) FILTER (WHERE status IN ('open','in_progress') AND due_at < NOW())::int AS overdue,
           count(*) FILTER (WHERE sla_breached)::int AS sla_breaches,
           round(avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE resolved_at IS NOT NULL)::numeric, 1) AS avg_resolution_hours,
           round(avg(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600) FILTER (WHERE first_response_at IS NOT NULL)::numeric, 1) AS avg_first_response_hours,
           round(avg(csat) FILTER (WHERE csat IS NOT NULL)::numeric, 2) AS avg_csat
         FROM support_tickets ${range}`,
        params
      ),
      queryDb(
        `SELECT assignee_email, MAX(assignee_name) AS assignee_name,
           count(*)::int AS assigned,
           count(*) FILTER (WHERE status IN ('resolved','closed'))::int AS closed,
           count(*) FILTER (WHERE status IN ('open','in_progress'))::int AS open,
           count(*) FILTER (WHERE status IN ('open','in_progress') AND due_at < NOW())::int AS overdue,
           count(*) FILTER (WHERE sla_breached)::int AS sla_breaches,
           round(avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE resolved_at IS NOT NULL)::numeric, 1) AS avg_resolution_hours,
           round(avg(csat) FILTER (WHERE csat IS NOT NULL)::numeric, 2) AS avg_csat
         FROM support_tickets ${range}
         GROUP BY assignee_email ORDER BY assigned DESC LIMIT 50`,
        params
      )
    ]);

    if (req.query.export === 'csv') {
      const header = ['Assignee', 'Email', 'Assigned', 'Closed', 'Open', 'Overdue', 'SLA breaches', 'Avg resolution (h)'];
      const lines = perAssignee.map((r) => [
        r.assignee_name, r.assignee_email, r.assigned, r.closed, r.open, r.overdue, r.sla_breaches, r.avg_resolution_hours ?? ''
      ].map(csvEscape).join(','));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="team-performance.csv"');
      return res.status(200).send([header.map(csvEscape).join(','), ...lines].join('\n'));
    }

    return res.status(200).json({ totals: totals[0] || {}, perAssignee });
  } catch (err) {
    if (isMissingTableError(err.message)) return res.status(200).json({ totals: {}, perAssignee: [] });
    return res.status(500).json({ error: err.message });
  }
}
