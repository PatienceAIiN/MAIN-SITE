import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ALLOWED_KEYS = new Set([
  'podcast/Hacking_B2B_trust_with_AI_video.m4a',
  'podcast/Conquering_the_UPSC_syllabus_with_PKT.m4a',
  'podcast/Automating_Indian_business_operations_with_Patience_AI.m4a',
  'podcast/Hacking_B2B_trust_with_AI_video_hi.m4a',
  'podcast/Conquering_the_UPSC_syllabus_with_PKT_hi.m4a',
  'podcast/Automating_Indian_business_operations_with_Patience_AI_hi.m4a',
  'podcast/Getting_law_firms_off_spreadsheets_with_Barrister.m4a',
  'podcast/Getting_law_firms_off_spreadsheets_with_Barrister_hi.m4a',
  'podcast/Volume_that_listens_to_the_room_inside_SoNex.m4a',
  'podcast/Volume_that_listens_to_the_room_inside_SoNex_hi.m4a',
  'podcast/Virtual_travel_you_can_feel.m4a',
  'podcast/Virtual_travel_you_can_feel_hi.m4a'
]);

let client = null;
const getClient = () => {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials are not configured');
  }
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED'
  });
  return client;
};

const isAllowedOrigin = (req) => {
  const siteUrl = process.env.SITE_URL || '';
  const allowed = new Set(
    [siteUrl, 'http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001']
      .filter(Boolean)
      .map((u) => u.replace(/\/$/, ''))
  );
  const origin = (req.headers?.origin || '').replace(/\/$/, '');
  const referer = req.headers?.referer || '';

  if (!origin && !referer) return true;
  if (origin && allowed.has(origin)) return true;
  try {
    if (referer) {
      const refOrigin = new URL(referer).origin;
      if (allowed.has(refOrigin)) return true;
    }
  } catch { /* swallow */ }
  return false;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const key = (req.query?.key || '').toString();
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ error: 'Invalid key' });
  }

  try {
    const bucket = process.env.R2_BUCKET_NAME || 'exchange';
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(getClient(), command, { expiresIn: 15 * 60 });
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.status(200).json({ url });
  } catch (error) {
    console.error('[podcast-url] signing failed');
    return res.status(500).json({ error: 'Failed to sign URL' });
  }
}
