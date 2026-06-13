import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../common/fetchJson';

// Admin → Growth tab. Controls who can sign in to the Business Growth OS
// (/growth). Only people with Growth access here can log in. You can:
//  • Grant/revoke access to people who already have a Patience AI account
//    (instant — no re-invite, no password reset).
//  • Invite a brand-new person (@patienceai.in) — sends an email whose link
//    sets a password and activates the account with Growth access.
const ALLOWED = '@patienceai.in';

export default function AdminGrowth() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', teamRole: 'member' });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetchJson('/api/team-members', { credentials: 'include' })
      .then((d) => setAll(d.members || [])).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const withAccess = useMemo(() => all.filter((m) => m.growth_access), [all]);
  const withoutAccess = useMemo(() => all.filter((m) => !m.growth_access), [all]);

  const patch = (body) => fetchJson('/api/team-members', {
    method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(load).catch((e) => setErr(e.message));

  const grant = (id) => patch({ id, growthAccess: true });
  const revoke = (id) => { if (window.confirm('Revoke this person\'s Growth access? They will no longer be able to sign in to /growth.')) patch({ id, growthAccess: false }); };
  const setStatus = (id, status) => patch({ id, status });
  const remove = (id) => { if (window.confirm('Remove this person entirely?')) fetchJson('/api/team-members', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(load).catch((e) => setErr(e.message)); };

  const invite = async (e) => {
    e.preventDefault(); setErr(''); setMsg('');
    if (!form.email.toLowerCase().endsWith(ALLOWED)) { setErr(`Only ${ALLOWED} email addresses are allowed.`); return; }
    setSending(true);
    try {
      const r = await fetchJson('/api/team-members', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email.trim().toLowerCase(), teamRole: form.teamRole, portal: 'growth' }),
      });
      setMsg(r.emailSent ? `Invite emailed to ${form.email} ✓` : `Invite created. Email failed — share this link: ${r.inviteLink || ''}`);
      setForm({ name: '', email: '', teamRole: 'member' });
      load();
    } catch (ex) { setErr(ex.message); } finally { setSending(false); }
  };

  const inp = 'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70';
  const statusChip = (s) => ['text-xs px-2.5 py-1 rounded-full font-medium', s === 'active' ? 'bg-emerald-400/20 text-emerald-300' : s === 'invited' ? 'bg-amber-400/20 text-amber-300' : 'bg-white/10 text-white/40'].join(' ');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Growth OS Access</h2>
          <p className="text-white/55 text-sm mt-1">Only the people listed here can sign in to <strong>/growth</strong>. Grant access to existing accounts instantly, or invite someone new.</p>
        </div>
        <a href="/growth" target="_blank" rel="noopener noreferrer" className="text-sm text-cyan-300 hover:text-cyan-100 underline underline-offset-2">Open Growth ↗</a>
      </div>

      {err && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100 text-sm">{err}</div>}
      {msg && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-emerald-100 text-sm break-all">{msg}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.7fr] gap-6">
        <div className="space-y-6">
          {/* Has access */}
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-semibold">Has Growth access ({withAccess.length})</h3>
              <button onClick={load} className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 border border-white/10">{loading ? 'Loading…' : 'Refresh'}</button>
            </div>
            <div className="divide-y divide-white/5">
              {withAccess.length === 0 && !loading && <p className="text-white/40 text-sm p-5">No one has Growth access yet. Grant it below or invite someone new.</p>}
              {withAccess.map((m) => (
                <div key={m.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{m.name}</p>
                    <p className="text-sm text-white/55 truncate">{m.email}</p>
                    {m.last_seen_at && <p className="text-xs text-white/30 mt-0.5">Last seen {new Date(m.last_seen_at).toLocaleString('en-IN')}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={statusChip(m.status)}>{m.status}</span>
                    {m.status === 'inactive' && <button onClick={() => setStatus(m.id, 'active')} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5">Activate</button>}
                    {m.status === 'active' && <button onClick={() => setStatus(m.id, 'inactive')} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5">Deactivate</button>}
                    <button onClick={() => revoke(m.id)} className="text-xs px-3 py-1.5 rounded-lg border border-amber-400/20 text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10">Revoke access</button>
                    <button onClick={() => remove(m.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-400/20 text-red-300/70 hover:text-red-200 hover:bg-red-500/10">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grant to existing */}
          {withoutAccess.length > 0 && (
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10"><h3 className="font-semibold">Grant access to existing accounts ({withoutAccess.length})</h3></div>
              <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
                {withoutAccess.map((m) => (
                  <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0"><p className="font-medium text-white truncate">{m.name}</p><p className="text-sm text-white/55 truncate">{m.email}</p></div>
                    <button onClick={() => grant(m.id)} className="text-xs px-3 py-1.5 rounded-lg bg-cyan-400/90 text-slate-950 font-semibold hover:bg-cyan-300 shrink-0">Grant Growth access</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Invite new */}
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 self-start">
          <h3 className="font-semibold mb-4">Invite a new person</h3>
          <form onSubmit={invite} className="space-y-3">
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Full name" className={inp} />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Email ({ALLOWED} only)</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required placeholder={`name${ALLOWED}`} pattern=".*@patienceai\.in$" title={`Must be a ${ALLOWED} email`} className={inp} />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Role</label>
              <select value={form.teamRole} onChange={(e) => setForm((f) => ({ ...f, teamRole: e.target.value }))} className={`${inp} appearance-none`}>
                {['member', 'product_manager', 'engineering_manager', 'team_lead', 'software_dev', 'qa'].map((r) => <option key={r} value={r} className="bg-slate-900">{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <button disabled={sending} className="w-full rounded-xl bg-cyan-400 text-slate-950 font-semibold py-3 hover:bg-cyan-300 disabled:opacity-50">{sending ? 'Sending…' : 'Send Growth invite'}</button>
          </form>
          <p className="text-xs text-white/40 mt-3">New invitees get an email with a link to set their password at /growth.</p>
        </div>
      </div>
    </div>
  );
}
