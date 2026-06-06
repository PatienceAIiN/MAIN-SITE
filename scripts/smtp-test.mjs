// Raw SMTP-over-TLS verification script using Node built-ins only.
// Usage: node scripts/smtp-test.mjs
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const i = trimmed.indexOf('=');
  if (i === -1) continue;
  const k = trimmed.slice(0, i).trim();
  let v = trimmed.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[k] = v;
}

const HOST = env.SMTP_HOST;
const PORT = parseInt(env.SMTP_PORT || '465', 10);
const USER = env.SMTP_USER;
const PASS = env.SMTP_PASS;
const TO   = env.CONTACT_TO_EMAIL;
const FROM_NAME = env.SMTP_SENDER_NAME || 'Patience AI';

const SUBJECT = `DPDP+Contact wiring test ${new Date().toISOString()}`;
const BODY = 'This is a wiring test from the Patience AI server to confirm SMTP delivery.\r\n';

console.log(`Connecting TLS to ${HOST}:${PORT} as ${USER} -> ${TO}`);

const socket = tls.connect({ host: HOST, port: PORT, servername: HOST, rejectUnauthorized: false });

let buf = '';
const expectations = [];

const send = (line) => {
  console.log(`> ${line.replace(/AUTH PLAIN .+/, 'AUTH PLAIN <redacted>')}`);
  socket.write(line + '\r\n');
};

const expect = (code) => new Promise((resolve, reject) => {
  expectations.push({ code, resolve, reject });
});

socket.setEncoding('utf8');
socket.on('data', (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf('\r\n')) >= 0) {
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 2);
    console.log(`< ${line}`);
    if (/^\d{3} /.test(line)) {
      const code = line.slice(0, 3);
      const exp = expectations.shift();
      if (!exp) continue;
      if (String(exp.code) === code) exp.resolve(line);
      else exp.reject(new Error(`Expected ${exp.code} got ${line}`));
    }
  }
});

socket.on('error', (e) => {
  console.error('SOCKET ERROR:', e.message);
  process.exit(2);
});

(async () => {
  try {
    await expect('220');
    send(`EHLO patienceai.in`);
    await expect('250');
    const authStr = Buffer.from('\0' + USER + '\0' + PASS).toString('base64');
    send(`AUTH PLAIN ${authStr}`);
    await expect('235');
    send(`MAIL FROM:<${USER}>`);
    await expect('250');
    send(`RCPT TO:<${TO}>`);
    await expect('250');
    send(`DATA`);
    await expect('354');
    const msg = [
      `From: "${FROM_NAME}" <${USER}>`,
      `To: <${TO}>`,
      `Subject: ${SUBJECT}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      BODY,
      `.`,
    ].join('\r\n') + '\r\n';
    socket.write(msg);
    console.log('> [DATA payload sent]');
    const finalLine = await expect('250');
    console.log('FINAL:', finalLine);
    send('QUIT');
    setTimeout(() => process.exit(0), 500);
  } catch (e) {
    console.error('SMTP FAIL:', e.message);
    process.exit(1);
  }
})();
