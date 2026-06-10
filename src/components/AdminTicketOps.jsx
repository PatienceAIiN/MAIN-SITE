import React, { useEffect, useState } from 'react';
import { fetchJson } from '../common/fetchJson';

// Admin "tickets" tab: team performance dashboard, SLA rules, categories,
// saved responses, knowledge base and the audit log. Styled to match the
// dark admin console.
const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—';

const card = 'rounded-[1.75rem] border border-white/10 bg-white/5 p-5';
const inputCls = 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70';
const btn = 'text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors';

export default function AdminTicketOps() {
  const [range, setRange] = useState({ dateFrom: '', dateTo: '' });
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState({ slas: [], categories: [], savedResponses: [] });
  const [articles, setArticles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [err, setErr] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newResponse, setNewResponse] = useState({ label: '', body: '' });
  const [kbDraft, setKbDraft] = useState({ id: null, title: '', kind: 'article', tags: '', body: '' });

  const loadStats = () => {
    const params = new URLSearchParams();
    if (range.dateFrom) params.set('dateFrom', range.dateFrom);
    if (range.dateTo) params.set('dateTo', range.dateTo);
    fetchJson(`/api/ticket-stats?${params.toString()}`).then(setStats).catch((e) => setErr(e.message));
  };
  const loadSettings = () => fetchJson('/api/ticket-settings').then(setSettings).catch((e) => setErr(e.message));
  const loadKb = () => fetchJson('/api/kb').then((d) => setArticles(d.articles || [])).catch(() => {});
  const loadAudit = () => fetchJson('/api/ticket-stats?audit=1').then((d) => setAuditLogs(d.logs || [])).catch(() => {});

  // Live view — no manual refresh needed; new tickets/audit entries appear on their own.
  useEffect(() => {
    loadSettings(); loadKb();
    const id = setInterval(() => { loadStats(); loadAudit(); }, 20000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { loadStats(); loadAudit(); }, [range.dateFrom, range.dateTo]);

  const updateSla = async (priority, hours) => {
    try {
      await fetchJson('/api/ticket-settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority, hours })
      });
      loadSettings();
    } catch (e) { setErr(e.message); }
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await fetchJson('/api/ticket-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryName: newCategory.trim() })
      });
      setNewCategory('');
      loadSettings();
    } catch (e) { setErr(e.message); }
  };

  const deleteSetting = async (body) => {
    try {
      await fetchJson('/api/ticket-settings', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      loadSettings();
    } catch (e) { setErr(e.message); }
  };

  const addResponse = async () => {
    if (!newResponse.label.trim() || !newResponse.body.trim()) return;
    try {
      await fetchJson('/api/ticket-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: newResponse })
      });
      setNewResponse({ label: '', body: '' });
      loadSettings();
    } catch (e) { setErr(e.message); }
  };

  const saveArticle = async () => {
    if (!kbDraft.title.trim() || !kbDraft.body.trim()) return;
    try {
      await fetchJson('/api/kb', {
        method: kbDraft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kbDraft)
      });
      setKbDraft({ id: null, title: '', kind: 'article', tags: '', body: '' });
      loadKb();
    } catch (e) { setErr(e.message); }
  };

  const deleteArticle = async (id) => {
    try {
      await fetchJson('/api/kb', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      loadKb();
    } catch (e) { setErr(e.message); }
  };

  const exportStats = () => {
    const params = new URLSearchParams();
    if (range.dateFrom) params.set('dateFrom', range.dateFrom);
    if (range.dateTo) params.set('dateTo', range.dateTo);
    params.set('export', 'csv');
    window.open(`/api/ticket-stats?${params.toString()}`, '_blank');
  };

  const t = stats?.totals || {};

  return (
    <div className="space-y-6">
      {err && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100 text-sm">{err}</div>}

      {/* ── Performance dashboard ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Ticket Operations</h2>
          <p className="text-white/55 text-sm mt-1">Team performance, SLA rules, categories, knowledge base and audit trail.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={range.dateFrom} onChange={(e) => setRange((r) => ({ ...r, dateFrom: e.target.value }))} className={inputCls} />
          <input type="date" value={range.dateTo} onChange={(e) => setRange((r) => ({ ...r, dateTo: e.target.value }))} className={inputCls} />
          <button onClick={exportStats} className={btn}>Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {[
          { label: 'Tickets created', value: t.created },
          { label: 'Closed', value: t.closed },
          { label: 'Open', value: t.open },
          { label: 'Overdue', value: t.overdue, alert: Number(t.overdue) > 0 },
          { label: 'SLA breaches', value: t.sla_breaches, alert: Number(t.sla_breaches) > 0 },
          { label: 'Avg resolution (h)', value: t.avg_resolution_hours ?? '—' },
          { label: 'Avg 1st response (h)', value: t.avg_first_response_hours ?? '—' }
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-center">
            <p className={`text-2xl font-bold ${kpi.alert ? 'text-red-300' : 'text-cyan-300'}`}>{kpi.value ?? 0}</p>
            <p className="text-xs text-white/50 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className={card}>
        <h3 className="text-lg font-semibold mb-3">Per-assignee performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-white/75">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                <th className="pb-2 pr-4">Assignee</th><th className="pb-2 pr-4">Assigned</th><th className="pb-2 pr-4">Closed</th>
                <th className="pb-2 pr-4">Open</th><th className="pb-2 pr-4">Overdue</th><th className="pb-2 pr-4">SLA breaches</th><th className="pb-2">Avg resolution (h)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(stats?.perAssignee || []).map((r) => (
                <tr key={r.assignee_email} className="hover:bg-white/5">
                  <td className="py-2 pr-4">{r.assignee_name} <span className="text-white/40">({r.assignee_email})</span></td>
                  <td className="py-2 pr-4">{r.assigned}</td>
                  <td className="py-2 pr-4">{r.closed}</td>
                  <td className="py-2 pr-4">{r.open}</td>
                  <td className={`py-2 pr-4 ${Number(r.overdue) > 0 ? 'text-red-300' : ''}`}>{r.overdue}</td>
                  <td className={`py-2 pr-4 ${Number(r.sla_breaches) > 0 ? 'text-red-300' : ''}`}>{r.sla_breaches}</td>
                  <td className="py-2">{r.avg_resolution_hours ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(stats?.perAssignee || []).length && <p className="text-white/40 text-sm py-3 text-center">No ticket data yet.</p>}
        </div>
      </div>

      {/* ── SLA + categories + saved responses ────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={card}>
          <h3 className="text-lg font-semibold mb-1">SLA rules</h3>
          <p className="text-xs text-white/45 mb-4">Response deadline per priority (hours). Applies to new tickets.</p>
          <div className="space-y-2">
            {['urgent', 'high', 'medium', 'low'].map((p) => {
              const current = settings.slas.find((s) => s.priority === p)?.hours ?? '';
              return (
                <div key={p} className="flex items-center gap-3">
                  <span className="w-20 text-sm capitalize text-white/75">{p}</span>
                  <input type="number" min="1" max="720" defaultValue={current} key={`${p}-${current}`}
                    onBlur={(e) => { const v = parseInt(e.target.value, 10); if (v && v !== Number(current)) updateSla(p, v); }}
                    className={`${inputCls} w-24`} />
                  <span className="text-xs text-white/40">hours</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={card}>
          <h3 className="text-lg font-semibold mb-1">Categories</h3>
          <p className="text-xs text-white/45 mb-4">Available when creating tickets.</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {settings.categories.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                {c.name}
                <button onClick={() => deleteSetting({ categoryId: c.id })} className="text-white/30 hover:text-red-300">✕</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category"
              onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }}
              className={`${inputCls} flex-1`} />
            <button onClick={addCategory} className={btn}>Add</button>
          </div>
        </div>

        <div className={card}>
          <h3 className="text-lg font-semibold mb-1">Saved responses</h3>
          <p className="text-xs text-white/45 mb-4">Quick replies for staff in ticket conversations.</p>
          <div className="space-y-2 mb-3 max-h-44 overflow-y-auto pr-1">
            {settings.savedResponses.map((r) => (
              <div key={r.id} className="rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">{r.label}</p>
                  <p className="text-[11px] text-white/50 truncate">{r.body}</p>
                </div>
                <button onClick={() => deleteSetting({ responseId: r.id })} className="text-white/30 hover:text-red-300 shrink-0">✕</button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <input value={newResponse.label} onChange={(e) => setNewResponse((r) => ({ ...r, label: e.target.value }))}
              placeholder="Label (e.g. Follow-up)" className={`${inputCls} w-full`} />
            <textarea value={newResponse.body} onChange={(e) => setNewResponse((r) => ({ ...r, body: e.target.value }))}
              placeholder="Response text" rows={2} className={`${inputCls} w-full resize-none`} />
            <button onClick={addResponse} className={btn}>Add response</button>
          </div>
        </div>
      </div>

      {/* ── Knowledge base ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.1fr] gap-6">
        <div className={card}>
          <h3 className="text-lg font-semibold mb-3">Knowledge base ({articles.length})</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {articles.length === 0 && <p className="text-white/40 text-sm">No articles yet — create FAQs and guides so executives see suggestions before raising tickets.</p>}
            {articles.map((a) => (
              <div key={a.id} className="rounded-xl bg-slate-900/60 border border-white/10 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white truncate">{a.title}</p>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-300/10 text-cyan-200 shrink-0">{a.kind}</span>
                </div>
                <p className="text-xs text-white/50 mt-1 line-clamp-2">{a.excerpt}</p>
                <div className="flex gap-2 mt-2">
                  <button className={btn} onClick={async () => {
                    const full = await fetchJson(`/api/kb?id=${a.id}`).catch(() => null);
                    if (full?.article) setKbDraft({ id: full.article.id, title: full.article.title, kind: full.article.kind, tags: full.article.tags || '', body: full.article.body });
                  }}>Edit</button>
                  <button className="text-xs px-3 py-1.5 rounded-lg border border-red-400/20 text-red-300/70 hover:text-red-200 hover:bg-red-500/10" onClick={() => deleteArticle(a.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={card}>
          <h3 className="text-lg font-semibold mb-3">{kbDraft.id ? `Edit article #${kbDraft.id}` : 'New article'}</h3>
          <div className="space-y-2">
            <input value={kbDraft.title} onChange={(e) => setKbDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Title" className={`${inputCls} w-full`} />
            <div className="flex gap-2">
              <select value={kbDraft.kind} onChange={(e) => setKbDraft((d) => ({ ...d, kind: e.target.value }))}
                className={`${inputCls} bg-slate-900`}>
                <option value="article">Article</option>
                <option value="faq">FAQ</option>
                <option value="guide">Troubleshooting guide</option>
              </select>
              <input value={kbDraft.tags} onChange={(e) => setKbDraft((d) => ({ ...d, tags: e.target.value }))}
                placeholder="Tags (comma separated)" className={`${inputCls} flex-1`} />
            </div>
            <textarea value={kbDraft.body} onChange={(e) => setKbDraft((d) => ({ ...d, body: e.target.value }))}
              placeholder="Article content" rows={8} className={`${inputCls} w-full resize-none`} />
            <div className="flex gap-2">
              <button onClick={saveArticle} className="text-xs px-4 py-2 rounded-lg bg-white text-slate-950 font-semibold hover:bg-white/90">
                {kbDraft.id ? 'Save changes' : 'Publish article'}
              </button>
              {kbDraft.id && (
                <button onClick={() => setKbDraft({ id: null, title: '', kind: 'article', tags: '', body: '' })} className={btn}>Cancel</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Audit log ──────────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Audit log</h3>
          <button onClick={loadAudit} className={btn}>Refresh</button>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
          {auditLogs.length === 0 && <p className="text-white/40 text-sm py-3">No audit entries yet.</p>}
          {auditLogs.map((l, i) => (
            <div key={i} className="py-2.5 flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="text-white/85">
                  <span className="text-cyan-300">{l.action.replace(/_/g, ' ')}</span>
                  {l.target && <span className="text-white/60"> — {l.target}</span>}
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  {l.actor_role || 'system'}{l.actor_email ? ` · ${l.actor_email}` : ''}
                  {l.metadata && ` · ${typeof l.metadata === 'string' ? l.metadata : JSON.stringify(l.metadata)}`}
                </p>
              </div>
              <span className="text-xs text-white/35 shrink-0">{fmt(l.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
