import React, { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../common/fetchJson';
import { uploadFiles } from './TicketCenter';

// JIRA-style Dev Tickets workspace for the team portal: list of assigned tickets
// + create, with a detail view (headline, assignee/reporter, story points, type,
// description, image/video attachments ≤20MB) and a team-visible comment thread.
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const TYPES = ['task', 'bug', 'story', 'spike', 'chore'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PRI_C = { low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', medium: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', high: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', urgent: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
const ST_C = { open: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', closed: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
const TYPE_ICON = { task: '✅', bug: '🐞', story: '📗', spike: '🔬', chore: '🧹' };
const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—';

const inp = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400';
const tb = 'text-xs px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50';
const tb2 = 'text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
const Chip = ({ t, cls }) => <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full font-semibold ${cls}`}>{t}</span>;

function Attachment({ a }) {
  const url = `/api/attachments?id=${a.id}`;
  const t = a.content_type || '';
  if (t.startsWith('image/')) return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={a.file_name} className="max-h-40 rounded-lg border border-slate-200 dark:border-slate-700" /></a>;
  if (t.startsWith('video/')) return <video src={url} controls className="max-h-48 rounded-lg border border-slate-200 dark:border-slate-700" />;
  return <a href={url} target="_blank" rel="noreferrer" className="text-xs underline text-indigo-600 dark:text-indigo-400">{a.file_name}</a>;
}

function CreateModal({ me, members, onClose, onCreated }) {
  const [d, setD] = useState({ subject: '', description: '', assigneeEmail: me.email, priority: 'medium', ticketType: 'task', storyPoints: '' });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!d.subject.trim()) { setErr('Summary is required'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetchJson('/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, devTicket: true }) });
      const id = r.ticket?.id;
      if (id && files.length) await uploadFiles(id, files);
      onCreated(id);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto p-5">
        <p className="text-base font-bold text-slate-900 dark:text-white mb-4">Create Dev Ticket</p>
        <div className="space-y-3">
          <input className={inp} placeholder="Summary / headline" value={d.subject} onChange={(e) => setD({ ...d, subject: e.target.value })} />
          <textarea className={`${inp} min-h-24`} placeholder="Description" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[11px] text-slate-400">Assignee
              <select className={inp} value={d.assigneeEmail} onChange={(e) => setD({ ...d, assigneeEmail: e.target.value })}>
                <option value={me.email}>{me.name} (me)</option>
                {members.filter((m) => m.email !== me.email).map((m) => <option key={m.email} value={m.email}>{m.name || m.email}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-slate-400">Type
              <select className={inp} value={d.ticketType} onChange={(e) => setD({ ...d, ticketType: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_ICON[t]} {t}</option>)}</select>
            </label>
            <label className="text-[11px] text-slate-400">Priority
              <select className={inp} value={d.priority} onChange={(e) => setD({ ...d, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            </label>
            <label className="text-[11px] text-slate-400">Story points
              <input type="number" min="0" className={inp} value={d.storyPoints} onChange={(e) => setD({ ...d, storyPoints: e.target.value })} />
            </label>
          </div>
          <label className="block text-[11px] text-slate-400">Attach image / video (≤20MB each)
            <input type="file" accept="image/*,video/*" multiple className="block mt-1 text-xs"
              onChange={(e) => setFiles([...e.target.files].filter((f) => /^(image|video)\//.test(f.type) && f.size <= 20 * 1024 * 1024))} />
          </label>
          {files.length > 0 && <p className="text-[11px] text-slate-400">{files.length} file(s) ready</p>}
          {err && <p className="text-red-500 text-xs">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button className={tb} disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create ticket'}</button>
            <button className={tb2} onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DevTickets({ member }) {
  const [tickets, setTickets] = useState([]);
  const [members, setMembers] = useState([]);
  const [selId, setSelId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [page, setPage] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const PER = 8;

  // Inline-edit any ticket field from the sidebar meta panel.
  const patch = async (fields) => {
    try { await fetchJson('/api/tickets', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selId, ...fields }) }); loadDetail(selId); loadList(); }
    catch (e) { setErr(e.message); }
  };

  const loadList = () => fetchJson('/api/tickets').then((d) => setTickets(d.tickets || [])).catch(() => {});
  const loadDetail = (id) => fetchJson(`/api/tickets?id=${id}`).then(setDetail).catch(() => setDetail(null));
  useEffect(() => { loadList(); fetchJson('/api/tickets?suggest=1').then((d) => setMembers(d.members || [])).catch(() => {}); const i = setInterval(loadList, 15000); return () => clearInterval(i); }, []);
  useEffect(() => { if (selId) { loadDetail(selId); const i = setInterval(() => loadDetail(selId), 6000); return () => clearInterval(i); } setDetail(null); }, [selId]);

  const list = useMemo(() => tickets.filter((t) => !q || `PA-${t.id} ${t.subject} ${t.assignee_name}`.toLowerCase().includes(q.toLowerCase())), [tickets, q]);
  const t = detail?.ticket;

  const addComment = async () => {
    if (!comment.trim() && !files.length) return;
    setBusy(true); setErr('');
    try {
      if (comment.trim()) await fetchJson('/api/tickets/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticketId: selId, message: comment, isInternal: false }) });
      if (files.length) { const errs = await uploadFiles(selId, files); if (errs.length) setErr(errs.join('; ')); }
      setComment(''); setFiles([]); loadDetail(selId);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-1 overflow-hidden flex-col md:flex-row bg-slate-50 dark:bg-slate-950">
      {/* Backlog sidebar */}
      <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 max-h-[40vh] md:max-h-none">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
          <button className={`${tb} w-full`} onClick={() => setCreateOpen(true)}>+ Create Dev Ticket</button>
          <input className={inp} placeholder="Search my dev tickets…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Assigned to me ({list.length})</p>
          {!list.length && <p className="text-xs text-slate-400 text-center py-6">No dev tickets yet.</p>}
          {list.slice(page * PER, page * PER + PER).map((tk) => (
            <button key={tk.id} onClick={() => setSelId(tk.id)}
              className={`w-full text-left px-3 py-2.5 border-b border-slate-50 dark:border-slate-800/60 ${selId === tk.id ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
              <p className="text-[10px] font-mono text-slate-400">{TYPE_ICON[tk.ticket_type] || '✅'} PA-{tk.id} · {tk.story_points != null ? `${tk.story_points} pts` : '—'}</p>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{tk.subject}</p>
              <span className="flex gap-1 mt-1"><Chip t={tk.status} cls={ST_C[tk.status]} /><Chip t={tk.priority} cls={PRI_C[tk.priority]} /></span>
            </button>
          ))}
          {list.length > PER && (
            <div className="flex items-center justify-center gap-2 py-3">
              <button className={tb2} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>‹ Prev</button>
              <span className="text-[11px] text-slate-400">{page + 1} / {Math.ceil(list.length / PER)}</span>
              <button className={tb2} disabled={(page + 1) * PER >= list.length} onClick={() => setPage((p) => p + 1)}>Next ›</button>
            </div>
          )}
        </div>
      </aside>

      {/* Detail */}
      <main className="flex-1 overflow-y-auto">
        {!t ? <div className="h-full flex items-center justify-center text-slate-400 text-sm">Select a ticket, or create one.</div> : (
          <div className="p-5 max-w-4xl mx-auto">
            <p className="text-[11px] font-mono text-slate-400">{TYPE_ICON[t.ticket_type] || '✅'} PA-{t.id}</p>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{t.subject}</h1>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-5">
              <div className="space-y-4 min-w-0">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Description</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{t.description || '—'}</p>
                </div>
                {detail.attachments?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Attachments</p>
                    <div className="flex flex-wrap gap-2">{detail.attachments.map((a) => <Attachment key={a.id} a={a} />)}</div>
                  </div>
                )}
                {/* Comments — visible to all team members */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Comments (visible to the whole team)</p>
                    {(detail.comments || []).filter((c) => !c.is_internal).length > 3 && (
                      <button className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline" onClick={() => setCommentsOpen(true)}>View all ({(detail.comments || []).filter((c) => !c.is_internal).length})</button>
                    )}
                  </div>
                  <div className="space-y-2 mb-3">
                    {(detail.comments || []).filter((c) => !c.is_internal).slice(-3).map((c) => (
                      <div key={c.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
                        <p className="text-[11px] text-slate-400">{c.author_name || c.author_role} · {fmt(c.created_at)}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{c.message}</p>
                      </div>
                    ))}
                    {!(detail.comments || []).filter((c) => !c.is_internal).length && <p className="text-xs text-slate-400">No comments yet.</p>}
                  </div>
                  <textarea className={`${inp} min-h-16`} placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <input type="file" accept="image/*,video/*" multiple className="text-xs"
                      onChange={(e) => setFiles([...e.target.files].filter((f) => /^(image|video)\//.test(f.type) && f.size <= 20 * 1024 * 1024))} />
                    <button className={tb} disabled={busy} onClick={addComment}>{busy ? 'Posting…' : 'Comment'}</button>
                    {files.length > 0 && <span className="text-[11px] text-slate-400">{files.length} file(s)</span>}
                  </div>
                  {err && <p className="text-red-500 text-xs mt-1">{err}</p>}
                </div>
              </div>
              {/* Meta panel — all fields editable inline (saves immediately) */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 h-fit text-sm space-y-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Details · click to edit</p>
                <label className="block"><span className="text-[10px] uppercase tracking-wider text-slate-400">Status</span>
                  <select value={t.status} onChange={(e) => patch({ status: e.target.value })} className={inp}>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
                </label>
                <label className="block"><span className="text-[10px] uppercase tracking-wider text-slate-400">Priority</span>
                  <select value={t.priority} onChange={(e) => patch({ priority: e.target.value })} className={inp}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                </label>
                <label className="block"><span className="text-[10px] uppercase tracking-wider text-slate-400">Type</span>
                  <select value={t.ticket_type || 'task'} onChange={(e) => patch({ ticketType: e.target.value })} className={inp}>{TYPES.map((x) => <option key={x} value={x}>{TYPE_ICON[x]} {x}</option>)}</select>
                </label>
                <label className="block"><span className="text-[10px] uppercase tracking-wider text-slate-400">Story points</span>
                  <input type="number" min="0" defaultValue={t.story_points ?? ''} onBlur={(e) => { if (String(e.target.value) !== String(t.story_points ?? '')) patch({ storyPoints: e.target.value }); }} className={inp} />
                </label>
                <label className="block"><span className="text-[10px] uppercase tracking-wider text-slate-400">Assigned to</span>
                  <select value={t.assignee_email} onChange={(e) => patch({ assigneeEmail: e.target.value })} className={inp}>
                    {!members.some((m) => m.email === t.assignee_email) && <option value={t.assignee_email}>{t.assignee_name || t.assignee_email}</option>}
                    {members.map((m) => <option key={m.email} value={m.email}>{m.name || m.email}</option>)}
                  </select>
                </label>
                <div className="flex justify-between gap-2 pt-1"><span className="text-[10px] uppercase tracking-wider text-slate-400">Assigned by</span><span className="text-xs text-slate-600 dark:text-slate-300">{t.created_by_name || '—'}</span></div>
                <div className="flex justify-between gap-2"><span className="text-[10px] uppercase tracking-wider text-slate-400">Created</span><span className="text-xs text-slate-600 dark:text-slate-300">{fmt(t.created_at)}</span></div>
                <div className="flex justify-between gap-2"><span className="text-[10px] uppercase tracking-wider text-slate-400">Due</span><span className="text-xs text-slate-600 dark:text-slate-300">{fmt(t.due_at)}</span></div>
              </div>
            </div>
          </div>
        )}
      </main>

      {createOpen && <CreateModal me={member} members={members} onClose={() => setCreateOpen(false)} onCreated={(id) => { setCreateOpen(false); loadList(); if (id) setSelId(id); }} />}

      {/* All comments — full view + add */}
      {commentsOpen && detail && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setCommentsOpen(false); }}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Comments · PA-{t.id}</p>
              <button onClick={() => setCommentsOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {(detail.comments || []).filter((c) => !c.is_internal).map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
                  <p className="text-[11px] text-slate-400">{c.author_name || c.author_role} · {fmt(c.created_at)}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{c.message}</p>
                </div>
              ))}
              {!(detail.comments || []).filter((c) => !c.is_internal).length && <p className="text-xs text-slate-400 text-center py-6">No comments yet.</p>}
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
              <textarea className={`${inp} min-h-10`} placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button className={tb} disabled={busy} onClick={addComment}>{busy ? '…' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
