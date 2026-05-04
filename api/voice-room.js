import crypto from 'node:crypto';
import { queryDb, isMissingTableError } from './_db.js';
import { getExecSession, getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';

const TABLE = 'voice_rooms';
const CHATS_TABLE = 'support_chats';
const isAdmin    = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));
const isExec     = (req) => Boolean(getExecSession(req));
const authorized = (req) => isAdmin(req) || isExec(req);

// Production-safe ICE config with free TURN relays for firewall/NAT traversal
const getIceServers = () => {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
  const turnUrl  = process.env.TURN_URL;
  const turnUser = process.env.TURN_USERNAME;
  const turnCred = process.env.TURN_CREDENTIAL;
  if (turnUrl && turnUser && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  }
  // Free open TURN (metered.ca openrelay) — improves prod connectivity behind NAT/firewalls
  servers.push(
    { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  );
  return servers;
};

const logCallMessage = async (conversationId, message) => {
  if (!conversationId || !message) return;
  await queryDb(
    `INSERT INTO ${CHATS_TABLE} (conversation_id, sender, message, created_at) VALUES ($1,'system',$2,NOW())`,
    [conversationId, message]
  ).catch((err) => console.error('[voice-room] call log failed:', err.message));
};

export default async function handler(req, res) {
  // ── GET /api/voice-room/ice-servers ──────────────────────────────────────
  if (req.method === 'GET' && req.url?.includes('/ice-servers')) {
    return res.status(200).json({ iceServers: getIceServers() });
  }

  // ── POST /api/voice-room ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { action } = req.body || {};

    // Customer OR executive creates a room with an offer
    if (action === 'create') {
      const { conversationId, offer, initiator } = req.body;
      if (!conversationId || !offer) return res.status(400).json({ error: 'conversationId and offer required' });
      if (initiator === 'executive' && !authorized(req))
        return res.status(401).json({ error: 'Unauthorized' });
      const roomId = crypto.randomBytes(8).toString('hex');
      try {
        // End any lingering calling rooms for this conversation
        await queryDb(
          `UPDATE ${TABLE} SET status='ended', updated_at=NOW() WHERE conversation_id=$1 AND status='calling'`,
          [conversationId]
        ).catch(() => {});
        const rows = await queryDb(
          `INSERT INTO ${TABLE} (room_id, conversation_id, offer, caller_candidates, status, initiator, created_at, updated_at)
           VALUES ($1,$2,$3,'[]','calling',$4,NOW(),NOW()) RETURNING *`,
          [roomId, conversationId, JSON.stringify(offer), initiator || 'customer']
        );
        await logCallMessage(conversationId, `Voice call started by ${initiator === 'executive' ? 'support executive' : 'customer'}.`);
        return res.status(200).json({ room: rows[0] });
      } catch (err) {
        if (isMissingTableError(err.message)) return res.status(500).json({ error: 'Voice rooms table not ready' });
        return res.status(500).json({ error: err.message });
      }
    }

    // Answerer responds (exec answers customer-initiated; customer answers exec-initiated)
    if (action === 'answer') {
      const { roomId, answer } = req.body;
      if (!roomId || !answer) return res.status(400).json({ error: 'roomId and answer required' });
      try {
        const rows = await queryDb(
          `UPDATE ${TABLE} SET answer=$1, status='active', updated_at=NOW() WHERE room_id=$2 RETURNING *`,
          [JSON.stringify(answer), roomId]
        );
        await logCallMessage(rows[0]?.conversation_id, 'Voice call connected.');
        return res.status(200).json({ room: rows[0] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ICE candidate exchange
    if (action === 'ice') {
      const { roomId, candidate, side } = req.body; // side: 'caller' | 'callee'
      if (!roomId || !candidate || !side) return res.status(400).json({ error: 'roomId, candidate, side required' });
      const col = side === 'caller' ? 'caller_candidates' : 'callee_candidates';
      try {
        const rows = await queryDb(`SELECT ${col} FROM ${TABLE} WHERE room_id=$1 LIMIT 1`, [roomId]);
        if (!rows.length) return res.status(404).json({ error: 'Room not found' });
        const existing = rows[0][col] || [];
        const updated = [...existing, candidate];
        await queryDb(`UPDATE ${TABLE} SET ${col}=$1, updated_at=NOW() WHERE room_id=$2`, [JSON.stringify(updated), roomId]);
        return res.status(200).json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // End call
    if (action === 'end') {
      const { roomId } = req.body;
      if (!roomId) return res.status(400).json({ error: 'roomId required' });
      try {
        const rows = await queryDb(`UPDATE ${TABLE} SET status='ended', updated_at=NOW() WHERE room_id=$1 AND status <> 'ended' RETURNING conversation_id`, [roomId]);
        await logCallMessage(rows[0]?.conversation_id, 'Voice call ended.');
        return res.status(200).json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (action === 'transcript') {
      const { roomId, text, side } = req.body;
      if (!roomId || !text) return res.status(400).json({ error: 'roomId and text required' });
      try {
        const rows = await queryDb(`SELECT conversation_id FROM ${TABLE} WHERE room_id=$1 LIMIT 1`, [roomId]);
        if (!rows.length) return res.status(404).json({ error: 'Room not found' });
        const speaker = side === 'executive' ? 'Support' : 'Customer';
        await logCallMessage(rows[0].conversation_id, `Transcript (${speaker}): ${String(text).slice(0, 1000)}`);
        return res.status(200).json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (action === 'bulk_transcript') {
      const { roomId, text, side } = req.body;
      if (!roomId || !text) return res.status(400).json({ error: 'roomId and text required' });
      try {
        const rows = await queryDb(`SELECT conversation_id FROM ${TABLE} WHERE room_id=$1 LIMIT 1`, [roomId]);
        if (!rows.length) return res.status(404).json({ error: 'Room not found' });
        const speaker = side === 'executive' ? 'Support' : 'Customer';
        await logCallMessage(rows[0].conversation_id, `Bulk Transcript (${speaker}): ${String(text).slice(0, 2000)}`);
        return res.status(200).json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  // ── GET /api/voice-room ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const roomId         = String(req.query.roomId         || '').trim();
    const conversationId = String(req.query.conversationId || '').trim();
    try {
      let rows;
      if (roomId) {
        rows = await queryDb(`SELECT * FROM ${TABLE} WHERE room_id=$1 LIMIT 1`, [roomId]);
      } else if (conversationId) {
        rows = await queryDb(
          `SELECT * FROM ${TABLE} WHERE conversation_id=$1 AND status IN ('calling','active') ORDER BY created_at DESC LIMIT 1`,
          [conversationId]
        );
      } else {
        return res.status(400).json({ error: 'roomId or conversationId required' });
      }
      return res.status(200).json({ room: rows[0] || null });
    } catch (err) {
      if (isMissingTableError(err.message)) return res.status(200).json({ room: null });
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
