import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import ffmpegPath from 'ffmpeg-static';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const ALLOWED_KEYS = new Set([
  'podcast/Hacking_B2B_trust_with_AI_video.m4a',
  'podcast/Conquering_the_UPSC_syllabus_with_PKT.m4a',
  'podcast/Automating_Indian_business_operations_with_Patience_AI.m4a'
]);

const GROQ_API = 'https://api.groq.com/openai/v1';
const HINDI_VOICE = 'hi-IN-MadhurNeural';
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

const hindiKeyFor = (key) => key.replace(/\.m4a$/, '_hi.m4a');

const headObject = async (bucket, key) => {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return false;
    throw e;
  }
};

const signGet = async (bucket, key) => {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(getClient(), cmd, { expiresIn: 15 * 60 });
};

const runFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg failed: ' + err.slice(-400)))));
  });

const downloadFromR2 = async (bucket, key, destPath) => {
  const obj = await getClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(destPath);
    obj.Body.on('error', reject);
    ws.on('error', reject);
    ws.on('finish', resolve);
    obj.Body.pipe(ws);
  });
};

const transcribeChunk = async (filePath) => {
  const buf = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'audio/mpeg' }), path.basename(filePath));
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'json');
  const res = await fetch(`${GROQ_API}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form
  });
  if (!res.ok) throw new Error('Whisper failed: ' + (await res.text()).slice(0, 200));
  const json = await res.json();
  return json.text || '';
};

const translateToHindi = async (text) => {
  const res = await fetch(`${GROQ_API}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a professional translator. Translate the user\'s English text into natural, fluent conversational Hindi (Devanagari). Preserve meaning and tone. Do NOT add commentary, notes, or quotation marks. Output ONLY the Hindi translation.'
        },
        { role: 'user', content: text }
      ]
    })
  });
  if (!res.ok) throw new Error('Translate failed: ' + (await res.text()).slice(0, 200));
  const json = await res.json();
  return (json.choices?.[0]?.message?.content || '').trim();
};

const synthesizeHindi = async (text, outPath) => {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(HINDI_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(outPath);
    audioStream.on('data', (d) => ws.write(d));
    audioStream.on('end', () => ws.end(resolve));
    audioStream.on('error', reject);
    ws.on('error', reject);
  });
};

const splitTextForTTS = (text, maxLen = 1500) => {
  const parts = [];
  let buf = '';
  for (const sentence of text.split(/(?<=[।!?])\s+/)) {
    if ((buf + ' ' + sentence).length > maxLen && buf) {
      parts.push(buf.trim());
      buf = sentence;
    } else {
      buf = buf ? buf + ' ' + sentence : sentence;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
};

const runPipeline = async (englishKey) => {
  const bucket = process.env.R2_BUCKET_NAME || 'exchange';
  const hindiKey = hindiKeyFor(englishKey);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'podtrans-'));

  try {
    const srcPath = path.join(workDir, 'src.m4a');
    await downloadFromR2(bucket, englishKey, srcPath);

    // Compress to 16kHz mono mp3 at 48kbps so a 30-60min podcast fits well under 25MB
    const compressedPath = path.join(workDir, 'compressed.mp3');
    await runFfmpeg(['-y', '-i', srcPath, '-ac', '1', '-ar', '16000', '-b:a', '48k', compressedPath]);

    // Split into 10-min chunks for safety
    const chunkPattern = path.join(workDir, 'chunk_%03d.mp3');
    await runFfmpeg(['-y', '-i', compressedPath, '-f', 'segment', '-segment_time', '600', '-c', 'copy', chunkPattern]);
    const chunkFiles = fs.readdirSync(workDir).filter((f) => /^chunk_\d+\.mp3$/.test(f)).sort();

    let transcript = '';
    for (const f of chunkFiles) {
      const text = await transcribeChunk(path.join(workDir, f));
      transcript += (transcript ? ' ' : '') + text;
    }
    if (!transcript.trim()) throw new Error('Empty transcript');

    // Translate in pieces to avoid token caps
    const enChunks = (function splitEn(t, max = 4000) {
      const out = [];
      let buf = '';
      for (const s of t.split(/(?<=[.!?])\s+/)) {
        if ((buf + ' ' + s).length > max && buf) { out.push(buf); buf = s; } else { buf = buf ? buf + ' ' + s : s; }
      }
      if (buf.trim()) out.push(buf.trim());
      return out;
    })(transcript);

    let hindiText = '';
    for (const piece of enChunks) {
      const tr = await translateToHindi(piece);
      hindiText += (hindiText ? '\n' : '') + tr;
    }

    // TTS each segment, then concat
    const ttsParts = splitTextForTTS(hindiText);
    const ttsFiles = [];
    for (let i = 0; i < ttsParts.length; i++) {
      const out = path.join(workDir, `tts_${String(i).padStart(3, '0')}.mp3`);
      await synthesizeHindi(ttsParts[i], out);
      ttsFiles.push(out);
    }

    const listFile = path.join(workDir, 'list.txt');
    fs.writeFileSync(listFile, ttsFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
    const finalPath = path.join(workDir, 'final.m4a');
    await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'aac', '-b:a', '96k', finalPath]);

    const finalBuf = fs.readFileSync(finalPath);
    await getClient().send(
      new PutObjectCommand({ Bucket: bucket, Key: hindiKey, Body: finalBuf, ContentType: 'audio/mp4' })
    );
    return hindiKey;
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* swallow */ }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const key = (req.query?.key || req.body?.key || '').toString();
  if (!ALLOWED_KEYS.has(key)) return res.status(400).json({ error: 'Invalid key' });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

  const bucket = process.env.R2_BUCKET_NAME || 'exchange';
  const hindiKey = hindiKeyFor(key);

  try {
    if (await headObject(bucket, hindiKey)) {
      const url = await signGet(bucket, hindiKey);
      return res.status(200).json({ status: 'ready', url, key: hindiKey });
    }
  } catch (e) {
    console.error('[podcast-translate] head failed');
  }

  const existing = jobs.get(hindiKey);
  if (existing) return res.status(202).json({ status: 'pending', jobId: existing.id });

  const id = randomUUID();
  const job = { id, key: hindiKey, status: 'pending', startedAt: Date.now() };
  jobs.set(hindiKey, job);

  (async () => {
    try {
      await runPipeline(key);
      job.status = 'ready';
    } catch (e) {
      job.status = 'failed';
      job.error = e.message;
      console.error('[podcast-translate]', e.message);
    } finally {
      setTimeout(() => jobs.delete(hindiKey), 10 * 60 * 1000);
    }
  })();

  return res.status(202).json({ status: 'pending', jobId: id });
}
