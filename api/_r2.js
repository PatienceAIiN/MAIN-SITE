// Cloudflare R2 object storage helper (S3-compatible).
// Used for ticket attachments: uploads go through the server (no bucket CORS
// required), downloads redirect to a short-lived presigned URL so file bytes
// stream straight from R2 — zero load on the app server and on Postgres.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';

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

export const isR2Configured = () => Boolean(
  process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME
);

const bucket = () => process.env.R2_BUCKET_NAME;

// Object keys are namespaced per ticket and salted with random bytes so they
// are unguessable even though download access is enforced at the API layer.
export const buildAttachmentKey = (ticketId, fileName) => {
  const safe = String(fileName).replace(/[^\w.-]+/g, '_').slice(0, 120);
  return `tickets/${ticketId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safe}`;
};

export const r2PutObject = async (key, body, contentType) => {
  await getClient().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream'
  }));
};

// 15-minute presigned GET. Content-Disposition is pinned so the browser shows
// the original file name regardless of the salted object key.
export const r2SignedGetUrl = async (key, fileName, expiresInSeconds = 900) => {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentDisposition: `inline; filename="${String(fileName).replace(/"/g, '')}"`
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
};

export const r2DeleteObject = async (key) => {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
};
