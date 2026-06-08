import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import ffmpegPath from 'ffmpeg-static';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GROQ_API = 'https://api.groq.com/openai/v1';
const EN_VOICE = 'en-US-AvaNeural';
const HI_VOICE = 'hi-IN-MadhurNeural';
const jobs = new Map();

let client = null;
const getClient = () => {
  if (client) return client;
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED'
  });
  return client;
};

const readBlogPost = (slug) => {
  const filePath = path.resolve(__dirname, '..', 'src', 'data', 'siteContent.json');
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const posts = json?.blogPage?.posts || [];
  return posts.find((p) => p.slug === slug) || null;
};

const sanitizeSlug = (slug) => /^[a-z0-9][a-z0-9-]{0,80}$/.test(slug);

const headObject = async (bucket, key) => {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return false;
    throw e;
  }
};

const signGet = async (bucket, key) =>
  getSignedUrl(getClient(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 15 * 60 });

const runFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg failed: ' + err.slice(-400)))));
  });

const translateToHindi = async (text) => {
  const res = await fetch(`${GROQ_API}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a professional translator. Translate the user\'s English blog text into natural, fluent conversational Hindi (Devanagari). Preserve meaning, structure, and tone. Do NOT add commentary, notes, or quotation marks. Output ONLY the Hindi translation.'
        },
        { role: 'user', content: text }
      ]
    })
  });
  if (!res.ok) throw new Error('Translate failed: ' + (await res.text()).slice(0, 200));
  const json = await res.json();
  return (json.choices?.[0]?.message?.content || '').trim();
};

const synthesizeSegment = async (text, voice, outPath) => {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(outPath);
    audioStream.on('data', (d) => ws.write(d));
    audioStream.on('end', () => ws.end(resolve));
    audioStream.on('error', reject);
    ws.on('error', reject);
  });
};

const splitText = (text, maxLen = 1500, sentenceSplit = /(?<=[.!?])\s+/) => {
  const parts = [];
  let buf = '';
  for (const s of text.split(sentenceSplit)) {
    if ((buf + ' ' + s).length > maxLen && buf) { parts.push(buf.trim()); buf = s; }
    else { buf = buf ? buf + ' ' + s : s; }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
};

const buildBlogText = (post) => {
  const intro = `${post.title}. By ${post.by || 'Patience AI'}.`;
  const body = Array.isArray(post.content) ? post.content.join('\n\n') : (post.content || post.excerpt || '');
  return `${intro}\n\n${body}`;
};

const runPipeline = async ({ slug, lang }) => {
  const bucket = process.env.R2_BUCKET_NAME || 'exchange';
  const key = lang === 'hi' ? `blog-podcast/${slug}_hi.m4a` : `blog-podcast/${slug}.m4a`;
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blogpod-'));

  try {
    const post = readBlogPost(slug);
    if (!post) throw new Error('Blog post not found');

    let text = buildBlogText(post);
    if (lang === 'hi') {
      const enChunks = splitText(text, 4000);
      let hi = '';
      for (const piece of enChunks) {
        const tr = await translateToHindi(piece);
        hi += (hi ? '\n\n' : '') + tr;
      }
      text = hi;
    }

    const segs = splitText(text, 1500, lang === 'hi' ? /(?<=[।!?])\s+/ : /(?<=[.!?])\s+/);
    const voice = lang === 'hi' ? HI_VOICE : EN_VOICE;
    const files = [];
    for (let i = 0; i < segs.length; i++) {
      const out = path.join(workDir, `seg_${String(i).padStart(3, '0')}.mp3`);
      await synthesizeSegment(segs[i], voice, out);
      files.push(out);
    }

    const listFile = path.join(workDir, 'list.txt');
    fs.writeFileSync(listFile, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
    const finalPath = path.join(workDir, 'final.m4a');
    await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'aac', '-b:a', '96k', finalPath]);

    const buf = fs.readFileSync(finalPath);
    await getClient().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buf, ContentType: 'audio/mp4' }));
    return key;
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* swallow */ }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const slug = (req.query?.slug || req.body?.slug || '').toString();
  const lang = (req.query?.lang || req.body?.lang || 'en').toString();
  if (!sanitizeSlug(slug)) return res.status(400).json({ error: 'Invalid slug' });
  if (!['en', 'hi'].includes(lang)) return res.status(400).json({ error: 'Invalid lang' });
  if (!process.env.GROQ_API_KEY && lang === 'hi') return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  if (!readBlogPost(slug)) return res.status(404).json({ error: 'Blog post not found' });

  const bucket = process.env.R2_BUCKET_NAME || 'exchange';
  const key = lang === 'hi' ? `blog-podcast/${slug}_hi.m4a` : `blog-podcast/${slug}.m4a`;

  try {
    if (await headObject(bucket, key)) {
      const url = await signGet(bucket, key);
      return res.status(200).json({ status: 'ready', url, key });
    }
  } catch { /* swallow */ }

  const existing = jobs.get(key);
  if (existing) return res.status(202).json({ status: 'pending', jobId: existing.id });

  const id = randomUUID();
  const job = { id, key, status: 'pending', startedAt: Date.now() };
  jobs.set(key, job);

  (async () => {
    try {
      await runPipeline({ slug, lang });
      job.status = 'ready';
    } catch (e) {
      job.status = 'failed';
      job.error = e.message;
      console.error('[blog-podcast]', slug, lang, e.message);
    } finally {
      setTimeout(() => jobs.delete(key), 10 * 60 * 1000);
    }
  })();

  return res.status(202).json({ status: 'pending', jobId: id });
}
