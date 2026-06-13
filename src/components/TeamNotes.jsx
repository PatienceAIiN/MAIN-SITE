import React, { useEffect, useState } from 'react';
import { fetchJson } from '../common/fetchJson';
import { confirmDialog } from '../common/confirm';

const inp = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400';
const tb = 'text-xs px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50';
const tb2 = 'text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
const card = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4';
const fmt = (v) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '';

/* ── Notes tab: manual notes + auto-saved Minutes of Meeting ─────────────── */
export function NotesTab() {
  const [notes, setNotes] = useState([]);
  const [edit, setEdit] = useState(null); // {id?, title, body}
  const [view, setView] = useState(null); // note opened in the read dialog
  const load = () => fetchJson('/api/notes').then((d) => setNotes(d.notes || [])).catch(() => {});
  useEffect(() => { load(); }, []);
  const save = async () => {
    const { id, title, body } = edit;
    if (id) await fetchJson('/api/notes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, title, body }) });
    else await fetchJson('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, kind: 'note' }) });
    setEdit(null); load();
  };
  const del = async (id) => { if (await confirmDialog({ title: 'Delete note', message: 'Delete this note? This cannot be undone.', confirmText: 'Delete' })) { await fetchJson(`/api/notes?id=${id}`, { method: 'DELETE' }); load(); } };
  return (
    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Notes</h2>
          <button className={tb} onClick={() => setEdit({ title: '', body: '' })}>+ New note</button>
        </div>
        {!notes.length && <p className="text-sm text-slate-400 text-center py-8">No notes yet. Use “+ New note”, or notes from a call land here automatically.</p>}
        {notes.map((n) => (
          <button key={n.id} onClick={() => setView(n)}
            className={`${card} w-full text-left cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors`}>
            <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">{n.kind === 'mom' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold">MoM</span>}{n.title}</p>
            <p className="text-[11px] text-slate-400">{n.author_name} · {fmt(n.updated_at)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap mt-2 line-clamp-2">{n.body}</p>
          </button>
        ))}
      </div>

      {/* Read dialog with full CRUD actions */}
      {view && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setView(null); }}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2 break-words">{view.kind === 'mom' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold shrink-0">MoM</span>}{view.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{view.author_name} · {fmt(view.updated_at)}</p>
              </div>
              <button onClick={() => setView(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg leading-none shrink-0">✕</button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{view.body}</p>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
              <button className={tb} onClick={() => { setEdit({ id: view.id, title: view.title, body: view.body }); setView(null); }}>Edit</button>
              <button className="text-xs px-3 py-2 rounded-lg border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 font-medium" onClick={() => { const id = view.id; setView(null); del(id); }}>Delete</button>
              <button className={`${tb2} ml-auto`} onClick={() => setView(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {edit && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setEdit(null); }}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-3">
            <p className="text-base font-bold text-slate-900 dark:text-white">{edit.id ? 'Edit note' : 'New note'}</p>
            <input className={inp} placeholder="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            <textarea className={`${inp} min-h-40`} placeholder="Write your note…" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            <div className="flex gap-2"><button className={tb} disabled={!edit.title.trim()} onClick={save}>Save</button><button className={tb2} onClick={() => setEdit(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Meetings tab: schedule + list (any team user) ───────────────────────── */
export function MeetingsTab() {
  const [meetings, setMeetings] = useState([]);
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ title: '', description: '', scheduledAt: '', durationMins: 30, attendees: [] });
  const load = () => fetchJson('/api/meetings').then((m) => setMeetings(m.meetings || [])).catch(() => {});
  useEffect(() => { load(); fetchJson('/api/colleagues?list=1').then((r) => setMembers(r.colleagues || [])).catch(() => {}); }, []);
  const create = async () => {
    await fetchJson('/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, scheduledAt: new Date(d.scheduledAt).toISOString() }) });
    setOpen(false); setD({ title: '', description: '', scheduledAt: '', durationMins: 30, attendees: [] }); load();
  };
  const del = async (id) => { if (await confirmDialog({ title: 'Cancel meeting', message: 'Cancel and delete this meeting?', confirmText: 'Delete meeting' })) { await fetchJson(`/api/meetings?id=${id}`, { method: 'DELETE' }); load(); } };
  const toggleAtt = (email) => setD((x) => ({ ...x, attendees: x.attendees.includes(email) ? x.attendees.filter((e) => e !== email) : [...x.attendees, email] }));
  return (
    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Meetings</h2>
          <button className={tb} onClick={() => setOpen(true)}>+ Schedule meeting</button>
        </div>
        {!meetings.length && <p className="text-sm text-slate-400 text-center py-8">No upcoming meetings.</p>}
        {meetings.map((m) => (
          <div key={m.id} className={`${card} flex items-start justify-between gap-2`}>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white">{m.title}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-300">{fmt(m.scheduled_at)} · {m.duration_mins} min</p>
              <p className="text-[11px] text-slate-400">by {m.created_by_name}{m.attendees ? ` · ${m.attendees.split(',').length} invited` : ''}</p>
              {m.description && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{m.description}</p>}
            </div>
            <span className="flex items-center gap-1.5 shrink-0">
              {m.room && <>
                <button className={tb} onClick={() => window.dispatchEvent(new CustomEvent('pa-join-meeting', { detail: { room: m.room, name: m.title } }))}>Join</button>
                <button className={tb2} title="Copy public join link — anyone (even without an account) can join"
                  onClick={() => { try { navigator.clipboard.writeText(`${location.origin}/meet?room=${m.room}`); } catch { /* ignore */ } }}>Copy link</button>
              </>}
              <button className="text-xs px-3 py-2 rounded-lg border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => del(m.id)}>Cancel</button>
            </span>
          </div>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-3 max-h-[88vh] overflow-y-auto">
            <p className="text-base font-bold text-slate-900 dark:text-white">Schedule meeting</p>
            <input className={inp} placeholder="Title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
            <textarea className={`${inp} min-h-20`} placeholder="Agenda / description" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] text-slate-400">When<input type="datetime-local" className={inp} value={d.scheduledAt} onChange={(e) => setD({ ...d, scheduledAt: e.target.value })} /></label>
              <label className="text-[11px] text-slate-400">Duration (min)<input type="number" min="5" className={inp} value={d.durationMins} onChange={(e) => setD({ ...d, durationMins: e.target.value })} /></label>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 mb-1">Invite attendees</p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((c) => (
                  <label key={c.email} className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={d.attendees.includes(c.email)} onChange={() => toggleAtt(c.email)} className="accent-indigo-500" />
                    <span className="truncate">{c.name} <span className="text-slate-400">· {c.email}</span></span>
                  </label>
                ))}
                {!members.length && <p className="text-xs text-slate-400 p-2">No colleagues found.</p>}
              </div>
            </div>
            <div className="flex gap-2"><button className={tb} disabled={!d.title.trim() || !d.scheduledAt} onClick={create}>Schedule &amp; invite</button><button className={tb2} onClick={() => setOpen(false)}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
