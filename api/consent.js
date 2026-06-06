import crypto from 'node:crypto';
import { queryDb } from './_db.js';

const POLICY_VERSION = '2026-06-07-dpdp-v1';

const CREATE_TABLE_SQL = `
  create table if not exists public.dpdp_consents (
    id uuid primary key,
    ip_hash text,
    user_agent text,
    categories_accepted jsonb not null,
    policy_version text not null,
    timestamp timestamptz not null default now()
  )
`;

const ensureTable = async () => {
  try {
    await queryDb(CREATE_TABLE_SQL);
  } catch (err) {
    // ignore — best effort
    console.error('[consent] ensureTable warning:', err.message);
  }
};

const hashIp = (ip = '') => {
  if (!ip) return null;
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 32);
};

const getClientIp = (req) => {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '';
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const categories = body.categories && typeof body.categories === 'object'
    ? {
        essential: true,
        analytics: Boolean(body.categories.analytics),
        marketing: Boolean(body.categories.marketing)
      }
    : null;

  if (!categories) {
    return res.status(400).json({ error: 'categories are required' });
  }

  const id = crypto.randomUUID();
  const ipHash = hashIp(getClientIp(req));
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 512);

  try {
    const insert = () => queryDb(
      `insert into public.dpdp_consents (id, ip_hash, user_agent, categories_accepted, policy_version)
       values ($1,$2,$3,$4::jsonb,$5)`,
      [id, ipHash, userAgent, JSON.stringify(categories), POLICY_VERSION]
    );
    try {
      await insert();
    } catch (err) {
      // Neon HTTP collapses missing-relation into a generic 400; always try once after ensuring the table.
      await ensureTable();
      await insert();
    }

    return res.status(200).json({ ok: true, id, policyVersion: POLICY_VERSION });
  } catch (err) {
    console.error('[consent] insert failed:', err.message);
    // Don't block the user if persistence fails — they still have local consent.
    return res.status(200).json({ ok: false, id, policyVersion: POLICY_VERSION, persisted: false });
  }
}
