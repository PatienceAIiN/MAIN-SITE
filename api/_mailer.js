import nodemailer from 'nodemailer';

const readInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readEnv = (primaryKey, fallbackKey = '') => {
  const primary = String(process.env[primaryKey] || '').trim();
  if (primary) return primary;
  if (!fallbackKey) return '';
  return String(process.env[fallbackKey] || '').trim();
};

const getTransportConfig = () => {
  const host = readEnv('SMTP_HOST', 'GODADDY_SMTP_HOST');
  const user = readEnv('SMTP_USER', 'GODADDY_SMTP_USER');
  const pass = readEnv('SMTP_PASS', 'GODADDY_SMTP_PASS');
  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port: readInt(readEnv('SMTP_PORT', 'GODADDY_SMTP_PORT'), 587),
    secure: String(readEnv('SMTP_SECURE', 'GODADDY_SMTP_SECURE') || 'false') === 'true',
    auth: {
      user,
      pass
    }
  };
};

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;
  const config = getTransportConfig();
  if (!config) return null;
  transporter = nodemailer.createTransport(config);
  return transporter;
};

export const sendInviteMail = async ({ to, inviteLink, invitedBy }) => {
  const mailer = getTransporter();
  if (!mailer) {
    throw new Error('SMTP is not configured. Set SMTP_* or GODADDY_SMTP_* env values.');
  }

  const from = readEnv('SMTP_FROM', 'GODADDY_SMTP_FROM') || readEnv('SMTP_USER', 'GODADDY_SMTP_USER');
  const appLabel = process.env.SUPPORT_APP_NAME || 'PatienceAI Support';

  await mailer.sendMail({
    from,
    to,
    subject: `${appLabel}: support executive invite`,
    text: `Hello,\n\n${invitedBy || 'Admin'} invited you to join as a support executive.\n\nAccept invite and set password: ${inviteLink}\n\nThis link expires in 48 hours.`,
    html: `<p>Hello,</p><p>${invitedBy || 'Admin'} invited you to join as a support executive.</p><p><a href="${inviteLink}">Accept invite and set password</a></p><p>This link expires in 48 hours.</p>`
  });
};
