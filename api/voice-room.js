import crypto from 'node:crypto';
import { queryDb, isMissingTableError } from './_db.js';
import { getExecSession, getCookieValue, SESSION_COOKIE_NAME, verifySessionToken } from './_security.js';

const TABLE = 'voice_rooms';

const isAdmin  = (req) => Boolean(verifySessionToken(getCookieValue(req, SESSION_COOKIE_NAME)));
const isExec   = (req) => Boolean(getExecSession(req));
const authorized = (req) => isAdmin(req) || isExec(req);

export default async function handler(req, res) {
  // ── POST /api/voice-room — create or update room ─────────────────────────
  if (req.method === 'POST') {
    const { conversationId, offer, answer, callerCandidates, calleeCandidates, action } = req.body || {};

    // Customer creates room with offer
    if (action === 'create') {
      if (!conversationId || !offer) return res.status(400).json({ error: 'conversationId and offer required' });
      const roomId = crypto.randomBytes(8).toString('hex');
      try {
        const rows = await queryDb(
          `INSERT INTO ${TABLE} (room_id, conversation_id, offer, caller_candidates, status, created_at, updated_at)
           VALUES ($1,$2,$3,'[]','calling',NOW(),NOW()) RETURNING *`,
          [roomId, conversationId, JSON.stringify(offer)]
        );
        return res.status(200).json({ room: rows[0] });
      } catch (err) {
        if (isMissingTableError(err.message)) return res.status(500).json({ error: 'Voice rooms table not ready' });
        return res.status(500).json({ error: err.message });
      }
    }

    // Executive answers
    if (action === 'answer') {
      if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
      const { roomId } = req.body;
      if (!roomId || !answer) return res.status(400).json({ error: 'roomId and answer required' });
      try {
        const rows = await queryDb(
          `UPDATE ${TABLE} SET answer=$1, status='active', updated_at=NOW() WHERE room_id=$2 RETURNING *`,
          [JSON.stringify(answer), roomId]
        );
        return res.status(200).json({ room: rows[0] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // Add ICE candidate
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
        await queryDb(`UPDATE ${TABLE} SET status='ended', updated_at=NOW() WHERE room_id=$1`, [roomId]);
        return res.status(200).json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  // ── GET /api/voice-room?roomId=X  or  ?conversationId=X ─────────────────
  if (req.method === 'GET') {
    const roomId = String(req.query.roomId || '').trim();
    const conversationId = String(req.query.conversationId || '').trim();
    try {
      let rows;
      if (roomId) {
        rows = await queryDb(`SELECT * FROM ${TABLE} WHERE room_id=$1 LIMIT 1`, [roomId]);
      } else if (conversationId) {
        rows = await queryDb(
          `SELECT * FROM ${TABLE} WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 1`,
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
