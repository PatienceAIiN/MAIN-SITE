// Growth → Connect. An isolated communications hub inside the Growth portal:
// chat + presence + voice/video meetings across three audiences — Team,
// Support executives, and External clients. Reuses the shared realtime hub
// (/ws/team), chat store (/api/colleagues), meeting scheduler (/api/meetings)
// and the guest meeting room (/meet?room=…) for the actual video/group calls,
// so it stays consistent with the rest of the platform while presenting a
// dedicated Growth surface.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiUsers, FiHeadphones, FiUserPlus, FiSearch, FiSend, FiVideo, FiCalendar,
  FiLink, FiX, FiPhoneCall, FiPlus, FiCopy, FiTrash2, FiClock, FiCheck,
  FiEdit2, FiFileText, FiMic,
} from 'react-icons/fi';
import { fetchJson } from '../common/fetchJson';
import { confirmDialog, Spinner } from '../common/confirm';
import { useGrowthHub, meetUrl } from '../common/growthHub';

const card = 'rounded-2xl bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800';
const input = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const btn = 'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50';
const btnPrimary = `${btn} bg-indigo-600 text-white hover:bg-indigo-500`;
const btnGhost = `${btn} bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;
const cApi = (path, opts = {}) => fetchJson(`/api/colleagues${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
const fmtT = (v) => v ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '';

const PRESENCE = {
  online: { label: 'Active', dot: 'bg-emerald-500' },
  away: { label: 'Away', dot: 'bg-amber-400' },
  busy: { label: 'On a call', dot: 'bg-red-400' },
  offline: { label: 'Offline', dot: 'bg-slate-300 dark:bg-slate-600' },
};
const Dot = ({ s }) => <span className={`inline-block w-2.5 h-2.5 rounded-full ${(PRESENCE[s] || PRESENCE.offline).dot}`} />;

/* ── Schedule / instant / edit meeting modal ──────────────────────────────── */
const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

function MeetingModal({ preset, editing, defaultOrganizer, onClose, onSaved }) {
  const isEdit = Boolean(editing?.id);
  const [f, setF] = useState({
    title: editing?.title || preset?.title || '',
    description: editing?.description || '',
    organizerName: editing?.created_by_name || defaultOrganizer || '',
    when: isEdit ? toLocalInput(editing.scheduled_at) : (preset?.instant ? '' : ''),
    durationMins: editing?.duration_mins || 30,
    instant: isEdit ? false : (preset?.instant ?? true),
    mode: editing?.mode || preset?.mode || 'video',
    attendees: isEdit ? String(editing.attendees || '').split(',').filter(Boolean) : (preset?.attendees || []),
  });
  const [extra, setExtra] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const addEmail = () => { const e = extra.trim().toLowerCase(); if (e && !f.attendees.includes(e)) { setF((s) => ({ ...s, attendees: [...s.attendees, e] })); setExtra(''); } };
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!f.title.trim()) { setErr('Give the meeting a title.'); return; }
    if (!f.organizerName.trim()) { setErr('Enter who is scheduling (organizer name).'); return; }
    const scheduledAt = f.instant ? new Date().toISOString() : new Date(f.when).toISOString();
    if (!f.instant && isNaN(new Date(f.when).getTime())) { setErr('Pick a valid date & time.'); return; }
    setSaving(true);
    try {
      const body = { title: f.title, description: f.description, organizerName: f.organizerName, scheduledAt, durationMins: Number(f.durationMins) || 30, attendees: f.attendees, mode: f.mode };
      const r = isEdit
        ? await fetchJson('/api/meetings', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...body }) })
        : await fetchJson('/api/meetings', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onSaved(r.meeting, f.instant && !isEdit);
    } catch (ex) { setErr(ex.message); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${card} w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-900 dark:text-white">{isEdit ? 'Edit meeting' : f.instant ? 'Start an instant meeting' : 'Schedule a meeting'}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX /></button></div>
        <form onSubmit={submit} className="space-y-3">
          <input className={input} placeholder="Meeting title" value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} required />
          <textarea className={input} rows="2" placeholder="Reason / agenda for the meeting…" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} />
          <input className={input} placeholder="Scheduled by (your name)" value={f.organizerName} onChange={(e) => setF((s) => ({ ...s, organizerName: e.target.value }))} required />
          {!isEdit && (
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => setF((s) => ({ ...s, instant: true }))} className={f.instant ? btnPrimary : btnGhost}><FiVideo size={14} /> Instant</button>
              <button type="button" onClick={() => setF((s) => ({ ...s, instant: false }))} className={!f.instant ? btnPrimary : btnGhost}><FiCalendar size={14} /> Schedule</button>
              <span className="mx-1 self-center text-slate-300">|</span>
              <button type="button" onClick={() => setF((s) => ({ ...s, mode: 'video' }))} className={f.mode === 'video' ? btnPrimary : btnGhost}><FiVideo size={14} /> Video</button>
              <button type="button" onClick={() => setF((s) => ({ ...s, mode: 'voice' }))} className={f.mode === 'voice' ? btnPrimary : btnGhost}><FiPhoneCall size={14} /> Voice</button>
            </div>
          )}
          {(!f.instant || isEdit) && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-500">Date &amp; time<input type="datetime-local" className={input} value={f.when} onChange={(e) => setF((s) => ({ ...s, when: e.target.value }))} required /></label>
              <label className="text-xs text-slate-500">Duration (min)<input type="number" className={input} value={f.durationMins} onChange={(e) => setF((s) => ({ ...s, durationMins: e.target.value }))} /></label>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500 mb-1">Attendees ({f.attendees.length}) — everyone gets an email invite with the time, reason &amp; join link</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {f.attendees.map((a) => <span key={a} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-full px-2 py-0.5">{a}<button type="button" onClick={() => setF((s) => ({ ...s, attendees: s.attendees.filter((x) => x !== a) }))}><FiX size={11} /></button></span>)}
            </div>
            <div className="flex gap-2"><input className={input} placeholder="Add email (external client too)…" value={extra} onChange={(e) => setExtra(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }} /><button type="button" className={btnGhost} onClick={addEmail}><FiPlus /></button></div>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={saving}>{saving ? <Spinner /> : (isEdit ? 'Save & notify' : f.instant ? 'Start now' : 'Schedule & invite')}</button></div>
        </form>
      </div>
    </div>
  );
}

/* ── Meeting notes / transcript modal ─────────────────────────────────────── */
function NotesModal({ meeting, onClose, onSaved }) {
  const [text, setText] = useState(meeting.notes || '');
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { const r = await fetchJson('/api/meetings', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notes', id: meeting.id, notes: text }) }); onSaved(r.meeting); } finally { setSaving(false); } };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className={`${card} w-full max-w-lg p-5`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">Notes — {meeting.title}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX /></button></div>
        <p className="text-xs text-slate-400 mb-2">Capture the call transcript, decisions and action items here.</p>
        <textarea className={`${input} font-mono text-xs`} rows="12" placeholder="Meeting notes / call transcript…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex justify-end gap-2 mt-3"><button className={btnGhost} onClick={onClose}>Close</button><button className={btnPrimary} disabled={saving} onClick={save}>{saving ? <Spinner /> : 'Save notes'}</button></div>
      </div>
    </div>
  );
}

/* ── Chat panel (internal 1:1) ────────────────────────────────────────────── */
function ChatPanel({ peer, liveChatId, onLive }) {
  const [chatId, setChatId] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    let on = true;
    cApi('', { method: 'POST', body: JSON.stringify({ action: 'create_chat', kind: 'dm', memberEmails: [peer.email] }) })
      .then((r) => { if (!on) return; setChatId(r.chat.id); onLive(r.chat.id); return cApi(`?messages=${r.chat.id}`); })
      .then((d) => { if (on && d) setMsgs(d.messages || []); }).catch(() => {});
    return () => { on = false; };
  }, [peer.email]); // eslint-disable-line
  useEffect(() => { if (liveChatId && liveChatId === chatId) cApi(`?messages=${chatId}`).then((d) => setMsgs(d.messages || [])).catch(() => {}); }, [liveChatId, chatId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  const send = async () => {
    const t = text.trim(); if (!t || !chatId) return; setText('');
    await cApi('', { method: 'POST', body: JSON.stringify({ action: 'send', chatId, message: t }) }).catch(() => {});
    cApi(`?messages=${chatId}`).then((d) => setMsgs(d.messages || [])).catch(() => {});
  };
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {!msgs.length && <p className="text-sm text-slate-400 text-center py-8">No messages yet. Say hi 👋</p>}
        {msgs.map((m) => {
          const mine = m.sender_email !== peer.email;
          return (
            <div key={m.id} className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'ml-auto bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
              {m.deleted ? <i className="opacity-60">deleted</i> : m.file_name ? <span>📎 {m.file_name}</span> : m.message}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
        <input className={input} placeholder={`Message ${peer.name}…`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className={btnPrimary} onClick={send}><FiSend /></button>
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
const TABS = [
  { key: 'team', label: 'Team', icon: FiUsers },
  { key: 'support', label: 'Support', icon: FiHeadphones },
  { key: 'clients', label: 'Clients', icon: FiUserPlus },
];

export default function GrowthConnect() {
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('team');
  const [roster, setRoster] = useState([]);
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null);        // selected internal peer for chat
  const [liveChatId, setLiveChatId] = useState(0);   // bumped on incoming chat WS event
  const [meetings, setMeetings] = useState([]);
  const [meetingModal, setMeetingModal] = useState(null); // { preset } | { editing }
  const [notesFor, setNotesFor] = useState(null);
  const [view, setView] = useState('people');        // 'people' | 'meetings'
  const [copied, setCopied] = useState('');

  // Single page-level socket (incoming-call popups handled portal-wide in GrowthPage).
  const { presence, send, subscribe } = useGrowthHub();
  useEffect(() => subscribe((m) => { if (m.type === 'chat' && m.message) setLiveChatId(m.chatId || m.message.chat_id); }), [subscribe]);

  const loadRoster = useCallback(() => cApi('?list=1').then((d) => setRoster(d.colleagues || [])).catch(() => {}), []);
  const loadClients = useCallback(() => fetchJson('/api/business/contacts', { credentials: 'include' }).then((d) => setClients((d.contacts || []).filter((c) => c.email))).catch(() => {}), []);
  const loadMeetings = useCallback(() => fetchJson('/api/meetings', { credentials: 'include' }).then((d) => setMeetings(d.meetings || [])).catch(() => {}), []);

  useEffect(() => { fetchJson('/api/team-members/me', { credentials: 'include' }).then((d) => setMe(d.member)).catch(() => {}); }, []);
  useEffect(() => { loadRoster(); loadClients(); loadMeetings(); const i = setInterval(loadRoster, 15000); return () => clearInterval(i); }, [loadRoster, loadClients, loadMeetings]);
  useEffect(() => { setRoster((rs) => rs.map((r) => ({ ...r, presence: presence[r.email] || 'offline' }))); }, [presence]);

  const team = useMemo(() => roster.filter((r) => r.side === 'team'), [roster]);
  const support = useMemo(() => roster.filter((r) => r.side === 'support'), [roster]);
  const ql = q.toLowerCase();
  const list = (tab === 'team' ? team : tab === 'support' ? support : clients)
    .filter((r) => `${r.name} ${r.email} ${r.company || ''}`.toLowerCase().includes(ql));

  // Instant 1:1 voice/video call to an online internal peer: spin up a room,
  // open it, ping the peer live (they get a Join toast) and email the link too.
  const callPeer = async (peer, mode = 'video') => {
    if ((peer.presence || 'offline') === 'offline') return; // calls only to online users
    try {
      const title = `${mode === 'voice' ? 'Voice' : 'Video'} call with ${me?.name || 'Growth'}`;
      const r = await fetchJson('/api/meetings', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, scheduledAt: new Date().toISOString(), durationMins: 30, attendees: [peer.email], mode, organizerName: me?.name }) });
      const room = r.meeting.room;
      const url = meetUrl(room) + (mode === 'voice' ? '&audio=1' : '');
      send({ type: 'rtc', to: peer.email, data: { kind: 'meet-invite', room: room + (mode === 'voice' ? '&audio=1' : ''), title } });
      window.open(url, '_blank', 'noopener');
      loadMeetings();
    } catch (e) { window.alert(e.message); }
  };

  const copy = (room) => { navigator.clipboard?.writeText(meetUrl(room)).then(() => { setCopied(room); setTimeout(() => setCopied(''), 1500); }); };
  const cancelMeeting = async (id) => { if (!(await confirmDialog({ title: 'Cancel meeting', message: 'Cancel and remove this meeting?', confirmText: 'Cancel meeting' }))) return; await fetchJson(`/api/meetings?id=${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => {}); loadMeetings(); };
  const onMeetingSaved = (mtg, openNow) => { setMeetingModal(null); loadMeetings(); if (openNow) window.open(meetUrl(mtg.room) + (mtg.mode === 'voice' ? '&audio=1' : ''), '_blank', 'noopener'); else setView('meetings'); };

  return (
    <div className="space-y-4">
      {/* Top bar: view switch + new meeting */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button onClick={() => setView('people')} className={`px-3 py-2 text-sm font-medium ${view === 'people' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>People &amp; chat</button>
          <button onClick={() => setView('meetings')} className={`px-3 py-2 text-sm font-medium ${view === 'meetings' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>Meetings ({meetings.length})</button>
        </div>
        <button className={`${btnPrimary} ml-auto`} onClick={() => setMeetingModal({ preset: { instant: false } })}><FiCalendar /> Schedule</button>
        <button className={btnGhost} onClick={() => setMeetingModal({ preset: { instant: true } })}><FiVideo /> Instant meeting</button>
      </div>

      {view === 'meetings' ? (
        <div className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
          {!meetings.length && <p className="text-sm text-slate-400 text-center py-12">No upcoming meetings. Schedule or start one above.</p>}
          {meetings.map((mtg) => (
            <div key={mtg.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{mtg.title}</div>
                <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap"><FiClock size={11} /> {fmtT(mtg.scheduled_at)} · {mtg.duration_mins}min · by {mtg.created_by_name}{mtg.attendees ? ` · ${mtg.attendees.split(',').filter(Boolean).length} invited` : ''}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 capitalize">{mtg.mode === 'voice' ? 'voice' : 'video'}</span>
                <button title="Notes / transcript" onClick={() => setNotesFor(mtg)} className="text-slate-400 hover:text-indigo-500 p-2"><FiFileText /></button>
                <button title="Edit & re-notify" onClick={() => setMeetingModal({ editing: mtg })} className="text-slate-400 hover:text-indigo-500 p-2"><FiEdit2 /></button>
                <button title="Copy join link" onClick={() => copy(mtg.room)} className="text-slate-400 hover:text-indigo-500 p-2">{copied === mtg.room ? <FiCheck className="text-emerald-500" /> : <FiCopy />}</button>
                <button className={btnPrimary} onClick={() => window.open(meetUrl(mtg.room) + (mtg.mode === 'voice' ? '&audio=1' : ''), '_blank', 'noopener')}>{mtg.mode === 'voice' ? <FiPhoneCall /> : <FiVideo />} Join</button>
                <button title="Cancel" onClick={() => cancelMeeting(mtg.id)} className="text-slate-400 hover:text-red-500 p-2"><FiTrash2 /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid lg:grid-cols-[340px_1fr] gap-4">
          {/* Left: tabs + directory */}
          <div className={`${card} flex flex-col`} style={{ height: 'calc(100vh - 230px)' }}>
            <div className="flex border-b border-slate-100 dark:border-slate-800">
              {TABS.map((t) => {
                const count = t.key === 'team' ? team.length : t.key === 'support' ? support.length : clients.length;
                return (
                  <button key={t.key} onClick={() => { setTab(t.key); setActive(null); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 ${tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <t.icon size={15} /> {t.label} <span className="text-xs text-slate-400">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="relative"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input className={`${input} pl-9`} placeholder={`Search ${tab}…`} value={q} onChange={(e) => setQ(e.target.value)} /></div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!list.length && <p className="text-sm text-slate-400 text-center py-10">No {tab} found.</p>}
              {list.map((r) => (
                <div key={`${r.email}-${r.side || 'c'}`} className={`px-3 py-2.5 border-b border-slate-50 dark:border-slate-800/60 flex items-center gap-2.5 ${tab !== 'clients' && active?.email === r.email ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                  <button className="flex items-center gap-2.5 min-w-0 flex-1 text-left" onClick={() => tab !== 'clients' && setActive(r)}>
                    {tab !== 'clients' ? <Dot s={r.presence} /> : <span className="w-2.5 h-2.5 rounded-full bg-violet-300" />}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.name}</span>
                      <span className="block text-[11px] text-slate-400 truncate">{tab === 'clients' ? (r.company || r.email) : (PRESENCE[r.presence] || PRESENCE.offline).label}</span>
                    </span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {tab !== 'clients' && (() => {
                      const off = (r.presence || 'offline') === 'offline';
                      const ttl = off ? `${r.name} is offline` : '';
                      return (<>
                        <button disabled={off} title={off ? `Voice call — ${ttl}` : 'Voice call'} onClick={() => callPeer(r, 'voice')} className={`p-1.5 rounded-lg ${off ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'}`}><FiPhoneCall size={15} /></button>
                        <button disabled={off} title={off ? `Video call — ${ttl}` : 'Video call'} onClick={() => callPeer(r, 'video')} className={`p-1.5 rounded-lg ${off ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950'}`}><FiVideo size={15} /></button>
                      </>);
                    })()}
                    <button title="Schedule meeting / invite" onClick={() => setMeetingModal({ preset: { instant: false, title: `Meeting with ${r.name}`, attendees: [r.email] } })} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950"><FiCalendar size={15} /></button>
                    {tab === 'clients' && <button title="Instant meeting + share link" onClick={() => setMeetingModal({ preset: { instant: true, title: `Meeting with ${r.name}`, attendees: [r.email] } })} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950"><FiLink size={15} /></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: chat (internal) or client hint */}
          <div className={`${card}`} style={{ height: 'calc(100vh - 230px)' }}>
            {tab !== 'clients' && active ? (
              <div className="flex flex-col h-full min-h-0">
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 min-w-0"><Dot s={active.presence} /><div className="min-w-0"><div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{active.name}</div><div className="text-[11px] text-slate-400">{(active.team_role || '').replace(/_/g, ' ')} · {(PRESENCE[active.presence] || PRESENCE.offline).label}</div></div></div>
                  <div className="flex items-center gap-1.5">
                    <button className={btnGhost} disabled={(active.presence || 'offline') === 'offline'} title={(active.presence || 'offline') === 'offline' ? `${active.name} is offline` : 'Voice call'} onClick={() => callPeer(active, 'voice')}><FiMic size={14} /></button>
                    <button className={btnGhost} disabled={(active.presence || 'offline') === 'offline'} title={(active.presence || 'offline') === 'offline' ? `${active.name} is offline` : 'Video call'} onClick={() => callPeer(active, 'video')}><FiVideo size={14} /> Call</button>
                    <button className={btnGhost} onClick={() => setMeetingModal({ preset: { instant: false, title: `Meeting with ${active.name}`, attendees: [active.email] } })}><FiCalendar size={14} /></button>
                  </div>
                </div>
                <ChatPanel peer={active} liveChatId={liveChatId} onLive={() => {}} />
              </div>
            ) : (
              <div className="h-full grid place-items-center text-center text-slate-400 p-8">
                <div>
                  {tab === 'clients' ? <><FiUserPlus size={28} className="mx-auto mb-3 text-slate-300" /><p className="text-sm">Pick a client to start an instant meeting or schedule a call.<br />They'll get an email invite with a shareable join link — no account needed.</p></>
                    : <><FiUsers size={28} className="mx-auto mb-3 text-slate-300" /><p className="text-sm">Select someone to chat, call, or schedule a meeting.</p></>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {meetingModal && <MeetingModal preset={meetingModal.preset} editing={meetingModal.editing} defaultOrganizer={me?.name} onClose={() => setMeetingModal(null)} onSaved={onMeetingSaved} />}
      {notesFor && <NotesModal meeting={notesFor} onClose={() => setNotesFor(null)} onSaved={(mtg) => { setNotesFor(null); setMeetings((ms) => ms.map((x) => x.id === mtg.id ? mtg : x)); }} />}
    </div>
  );
}
