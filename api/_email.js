import nodemailer from 'nodemailer';
import SibApiV3Sdk from 'sib-api-v3-sdk';

const normalizeEmailAddress = (value = '') => {
  const input = String(value).trim();
  if (!input) return '';
  const angleMatch = input.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();
  return input.replace(/^mailto:/i, '').trim();
};

const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmailAddress(value));

const normalizeRecipient = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const email = normalizeEmailAddress(value);
    return email ? { email } : null;
  }
  const email = normalizeEmailAddress(value.email || '');
  if (!email) return null;
  return { email, name: value.name ? String(value.name).trim() : undefined };
};

export const getEmailProvider = () => {
  const brevoApiKey = (process.env.BREVO_API_KEY || '').trim();
  const brevoSender = normalizeEmailAddress(
    process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM || ''
  );
  if (brevoApiKey && isValidEmail(brevoSender)) {
    return {
      kind: 'brevo',
      apiKey: brevoApiKey,
      senderEmail: brevoSender,
      senderName: (process.env.BREVO_SENDER_NAME || process.env.SMTP_SENDER_NAME || 'PATIENCE AI').trim()
    };
  }

  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  if (smtpUser && smtpPass) {
    const smtpFrom = normalizeEmailAddress(process.env.SMTP_FROM || '');
    return {
      kind: 'smtp',
      senderEmail: smtpFrom && isValidEmail(smtpFrom) ? smtpFrom : smtpUser,
      senderName: (process.env.SMTP_SENDER_NAME || 'PATIENCE AI').trim(),
      smtpUser
    };
  }

  return null;
};

let cachedTransporter = null;
let cachedTransporterKey = '';

const getSmtpTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const rawSecure = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
  const secure = rawSecure ? rawSecure === 'true' : port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const key = `${host}|${port}|${secure}|${user}`;

  if (cachedTransporter && cachedTransporterKey === key) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    tls: { servername: host },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });
  cachedTransporterKey = key;
  return cachedTransporter;
};

const sendViaBrevo = async ({ provider, to, replyTo, subject, html, text }) => {
  const apiClient = SibApiV3Sdk.ApiClient.instance;
  apiClient.authentications['api-key'].apiKey = provider.apiKey;
  const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();
  const request = new SibApiV3Sdk.SendSmtpEmail();
  request.sender = { email: provider.senderEmail, name: provider.senderName };
  request.to = (Array.isArray(to) ? to : [to]).map(normalizeRecipient).filter(Boolean);
  request.subject = subject;
  if (html) request.htmlContent = html;
  if (text) request.textContent = text;
  if (replyTo) {
    const r = normalizeRecipient(replyTo);
    if (r) request.replyTo = r;
  }
  await emailApi.sendTransacEmail(request);
};

const sendViaSmtp = async ({ provider, to, replyTo, subject, html, text }) => {
  const transporter = getSmtpTransporter();
  const recipients = (Array.isArray(to) ? to : [to])
    .map(normalizeRecipient)
    .filter(Boolean)
    .map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email));
  const rt = replyTo ? normalizeRecipient(replyTo) : null;
  await transporter.sendMail({
    from: `"${provider.senderName}" <${provider.senderEmail}>`,
    to: recipients.join(', '),
    replyTo: rt ? (rt.name ? `"${rt.name}" <${rt.email}>` : rt.email) : undefined,
    subject,
    html,
    text
  });
};

export const sendEmail = async ({ to, replyTo, subject, html, text }) => {
  const provider = getEmailProvider();
  if (!provider) throw new Error('No email provider configured. Set BREVO_API_KEY+BREVO_SENDER_EMAIL or SMTP_*.');
  if (provider.kind === 'brevo') return sendViaBrevo({ provider, to, replyTo, subject, html, text });
  return sendViaSmtp({ provider, to, replyTo, subject, html, text });
};

export { normalizeEmailAddress, isValidEmail, normalizeRecipient };
