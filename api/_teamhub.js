// Realtime hub for the team portal (open-source `ws`). One WebSocket per
// browser tab at /ws/team, authenticated with the member session cookie.
//
// Responsibilities:
//  - presence: online / away (no user activity for 10 min) / offline (no socket)
//  - typing indicators (relayed to the other chat members)
//  - chat fan-out (REST writes call broadcastToEmails to push instantly)
//  - WebRTC signaling relay for 1:1 video calls (offer/answer/ice/hangup)
import { WebSocketServer } from 'ws';
import { getCookieValue, MEMBER_SESSION_COOKIE_NAME, EXEC_SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';
import { sendPushToEmails } from './_push.js';
import { queryDb } from './_db.js';

const AWAY_AFTER_MS = 10 * 60 * 1000;

// email -> { name, sockets:Set<ws>, lastActivity:ms, away:boolean }
const users = new Map();
// roomId -> Map<email,name> : live occupants of open group-call (meeting) rooms.
const gcallRooms = new Map();

const statusOf = (u) => {
  if (!u || u.sockets.size === 0) return 'offline';
  if (u.manualStatus === 'offline') return 'offline';   // user chose "appear offline"
  if (u.busy) return 'busy';   // on a call — others see a chip and can't dial in
  if (u.manualStatus === 'away' || u.manualStatus === 'online') return u.manualStatus;
  return Date.now() - u.lastActivity > AWAY_AFTER_MS ? 'away' : 'online';
};

// Record a work/presence transition for the admin timesheet. 'busy' counts as
// working time, so it's logged as 'online'. Fire-and-forget.
const logPresence = (email, name, role, status) => {
  const s = status === 'busy' ? 'online' : status;
  if (!['online', 'away', 'offline'].includes(s)) return;
  queryDb(`INSERT INTO presence_log (email, name, role, status) VALUES ($1,$2,$3,$4)`, [email, name || null, role || null, s]).catch(() => {});
};

export const presenceSnapshot = () => {
  const out = {};
  for (const [email, u] of users) { if (u.guest) continue; out[email] = statusOf(u); }
  return out;
};

const safeSend = (ws, obj) => {
  if (ws.readyState === 1) { try { ws.send(JSON.stringify(obj)); } catch { /* closing */ } }
};

export const broadcastToEmails = (emails, payload) => {
  const set = new Set(emails);
  for (const [email, u] of users) {
    if (!set.has(email)) continue;
    for (const ws of u.sockets) safeSend(ws, payload);
  }
};

export const hasActiveSocket = (email) => (users.get(email)?.sockets.size || 0) > 0;

const broadcastPresence = () => {
  const payload = { type: 'presence', users: presenceSnapshot() };
  for (const [, u] of users) for (const ws of u.sockets) safeSend(ws, payload);
};

export const attachTeamHub = (server) => {
  const wss = new WebSocketServer({ server, path: '/ws/team' });

  wss.on('connection', (ws, req) => {
    // Team members AND support executives share the hub — chat, presence and
    // calls work across both sides.
    let payload = verifySessionToken(getCookieValue(req, MEMBER_SESSION_COOKIE_NAME));
    if (!payload || payload.role !== 'member') {
      payload = verifySessionToken(getCookieValue(req, EXEC_SESSION_COOKIE_NAME));
      if (!payload || payload.role !== 'executive') {
        // Public guest: allowed ONLY to join a specific meeting room via its
        // shared link (the unguessable room token is the access credential). No
        // account, no presence, and restricted to gcall/rtc for that one room.
        const guestRoom = new URL(req.url, 'http://x').searchParams.get('guestRoom');
        if (!guestRoom) { ws.close(4001, 'unauthorized'); return; }
        const gname = (new URL(req.url, 'http://x').searchParams.get('guestName') || 'Guest').slice(0, 40);
        payload = { email: 'guest:' + Math.random().toString(36).slice(2, 11), name: gname, role: 'guest', guestRoom };
      }
    }
    const email = payload.email;
    const isGuest = payload.role === 'guest';

    let u = users.get(email);
    const wasOffline = !u || u.sockets.size === 0;
    if (!u) { u = { name: payload.name, sockets: new Set(), lastActivity: Date.now(), busy: false, loggedStatus: 'offline', guest: isGuest }; users.set(email, u); }
    u.sockets.add(ws);
    u.lastActivity = Date.now();
    ws.isAlive = true;
    if (!isGuest && wasOffline) { u.loggedStatus = 'online'; logPresence(email, payload.name, payload.role, 'online'); }

    if (!isGuest) { safeSend(ws, { type: 'presence', users: presenceSnapshot() }); broadcastPresence(); }

    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      // Guests are confined to call signalling for their own room only.
      if (isGuest) {
        if (msg.type === 'rtc' && msg.data?.room === payload.guestRoom) { /* allowed */ }
        else if (msg.type === 'gcall' && msg.room === payload.guestRoom) { /* allowed */ }
        else return;
      }

      if (msg.type === 'activity') {
        const wasAway = statusOf(u) !== 'online';
        u.lastActivity = Date.now();
        if (wasAway) {
          if (u.loggedStatus !== 'online') { u.loggedStatus = 'online'; logPresence(email, u.name, payload.role, 'online'); }
          broadcastPresence();
        }
        return;
      }
      // Open group-call room registry (for shareable meeting links): anyone with
      // the link can join; the hub tells the joiner who's already there and tells
      // the existing occupants a newcomer arrived, so the mesh forms for an
      // un-predefined participant set.
      if (msg.type === 'gcall' && msg.room) {
        let room = gcallRooms.get(msg.room);
        if (msg.op === 'join') {
          if (!room) { room = new Map(); gcallRooms.set(msg.room, room); }
          const others = [...room.entries()].filter(([e]) => e !== email).map(([e, n]) => ({ email: e, name: n }));
          room.set(email, payload.name || email);
          safeSend(ws, { type: 'gcall', op: 'roster', room: msg.room, members: others });
          broadcastToEmails([...room.keys()].filter((e) => e !== email), { type: 'gcall', op: 'joined', room: msg.room, email, name: payload.name || email });
        } else if (msg.op === 'leave') {
          if (room) { room.delete(email); if (!room.size) gcallRooms.delete(msg.room); }
          broadcastToEmails(room ? [...room.keys()] : [], { type: 'gcall', op: 'left', room: msg.room, email });
        }
        return;
      }
      // Manual presence override (online / away / appear offline).
      if (msg.type === 'setstatus') {
        u.manualStatus = ['online', 'away', 'offline'].includes(msg.status) ? msg.status : null;
        broadcastPresence();
        return;
      }
      // Call busy state — flip presence to 'busy' while on a call.
      if (msg.type === 'callstate') {
        const busy = Boolean(msg.busy);
        if (u.busy !== busy) { u.busy = busy; broadcastPresence(); }
        return;
      }
      if (msg.type === 'typing' && Array.isArray(msg.to)) {
        broadcastToEmails(msg.to.filter((e) => e !== email),
          { type: 'typing', chatId: msg.chatId, email, name: payload.name });
        return;
      }
      // WebRTC signaling relay: { type:'rtc', to, data:{kind:'offer'|'answer'|'ice'|'hangup'|'decline', ...} }
      if (msg.type === 'rtc' && msg.to && msg.data) {
        broadcastToEmails([msg.to], { type: 'rtc', from: email, fromName: payload.name, data: msg.data });
        // Push-notify an incoming call if the callee has no portal tab open.
        if (msg.data.kind === 'offer' && !hasActiveSocket(msg.to)) {
          sendPushToEmails([msg.to], {
            title: `Incoming ${msg.data.video === false ? 'voice' : 'video'} call`,
            body: `${payload.name || email} is calling you`,
            url: '/team', tag: 'call'
          });
        }
      }
    });

    ws.on('close', () => {
      u.sockets.delete(ws);
      // Guests carry no presence — just remove them from their room and notify.
      if (isGuest) {
        if (u.sockets.size === 0) {
          users.delete(email);
          for (const [rid, room] of gcallRooms) {
            if (room.delete(email)) { broadcastToEmails([...room.keys()], { type: 'gcall', op: 'left', room: rid, email }); if (!room.size) gcallRooms.delete(rid); }
          }
        }
        return;
      }
      if (u.sockets.size === 0) setTimeout(() => {
        // grace period so a page refresh doesn't flash offline
        if (u.sockets.size === 0) {
          users.delete(email);
          // Drop them from any open call rooms and tell remaining occupants.
          for (const [rid, room] of gcallRooms) {
            if (room.delete(email)) { broadcastToEmails([...room.keys()], { type: 'gcall', op: 'left', room: rid, email }); if (!room.size) gcallRooms.delete(rid); }
          }
          broadcastPresence();
          logPresence(email, u.name, payload.role, 'offline');
          // durable "last seen" for the roster (member or executive)
          queryDb(`UPDATE team_members SET last_seen_at=NOW() WHERE email=$1`, [email]).catch(() => {});
          queryDb(`UPDATE support_executives SET last_seen_at=NOW() WHERE email=$1`, [email]).catch(() => {});
        }
      }, 5000);
      else broadcastPresence();
    });
  });

  // Heartbeat (drops dead sockets) + away-transition rebroadcast
  let lastSnapshot = '';
  setInterval(() => {
    for (const client of wss.clients) {
      if (client.isAlive === false) { client.terminate(); continue; }
      client.isAlive = false;
      try { client.ping(); } catch { /* closing */ }
    }
    // Log online→away transitions for the timesheet.
    for (const [email, u] of users) {
      const st = statusOf(u);
      if (st === 'away' && u.loggedStatus === 'online') { u.loggedStatus = 'away'; logPresence(email, u.name, null, 'away'); }
    }
    const snap = JSON.stringify(presenceSnapshot());
    if (snap !== lastSnapshot) { lastSnapshot = snap; broadcastPresence(); }
  }, 30000).unref();

  return wss;
};
