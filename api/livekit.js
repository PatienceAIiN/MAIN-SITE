// Mints a short-lived LiveKit access token so a user can join a video room.
// Media (audio/video) flows through LiveKit's media server; the token scopes the
// holder to a single room. Logged-in members/execs get an identity derived from
// their email; guests joining a shared /meet link get a guest identity (the
// unguessable room id in the link is the access control, as before).
import { AccessToken } from 'livekit-server-sdk';
import { getMemberSession, getExecSession } from './_security.js';

export default async function handler(req, res) {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) return res.status(200).json({ error: 'Video calling is not configured (LIVEKIT_* env missing).' });

  const roomName = String(req.query.room || (req.body || {}).room || '').trim();
  if (!roomName || roomName.length > 200) return res.status(400).json({ error: 'room is required' });

  const member = getMemberSession(req) || getExecSession(req);
  const rand = Math.random().toString(36).slice(2, 8);
  let identityBase = 'guest';
  let displayName = String(req.query.name || (req.body || {}).name || 'Guest').slice(0, 80);
  if (member) {
    identityBase = String(member.email || 'user').toLowerCase();
    displayName = member.name || member.email || displayName;
  }
  // Unique identity per join (allows the same person on phone + desktop at once
  // without them kicking each other, and keeps the email recoverable for MoM).
  const identity = `${identityBase}__${rand}`;

  try {
    const at = new AccessToken(key, secret, { identity, name: displayName, ttl: '3h' });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true, canPublishData: true });
    const token = await at.toJwt();
    return res.status(200).json({ url, token, identity, name: displayName });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
