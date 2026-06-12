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

const statusOf = (u) => {
  if (!u || u.sockets.size === 0) return 'offline';
  if (u.busy) return 'busy';   // on a call — others see a chip and can't dial in
  return Date.now() - u.lastActivity > AWAY_AFTER_MS ? 'away' : 'online';
};

export const presenceSnapshot = () => {
  const out = {};
  for (const [email, u] of users) out[email] = statusOf(u);
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
      if (!payload || payload.role !== 'executive') { ws.close(4001, 'unauthorized'); return; }
    }
    const email = payload.email;

    let u = users.get(email);
    if (!u) { u = { name: payload.name, sockets: new Set(), lastActivity: Date.now(), busy: false }; users.set(email, u); }
    u.sockets.add(ws);
    u.lastActivity = Date.now();
    ws.isAlive = true;

    safeSend(ws, { type: 'presence', users: presenceSnapshot() });
    broadcastPresence();

    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'activity') {
        const wasAway = statusOf(u) !== 'online';
        u.lastActivity = Date.now();
        if (wasAway) broadcastPresence();
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
            title: `Incoming video call`,
            body: `${payload.name || email} is calling you`,
            url: '/team', tag: 'call'
          });
        }
      }
    });

    ws.on('close', () => {
      u.sockets.delete(ws);
      if (u.sockets.size === 0) setTimeout(() => {
        // grace period so a page refresh doesn't flash offline
        if (u.sockets.size === 0) {
          users.delete(email);
          broadcastPresence();
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
    const snap = JSON.stringify(presenceSnapshot());
    if (snap !== lastSnapshot) { lastSnapshot = snap; broadcastPresence(); }
  }, 30000).unref();

  return wss;
};
