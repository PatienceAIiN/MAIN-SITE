import nodemailer from 'nodemailer';

const readInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getTransportConfig = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return {
    host: process.env.SMTP_HOST,
    port: readInt(process.env.SMTP_PORT, 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
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
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.');
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const appLabel = process.env.SUPPORT_APP_NAME || 'PatienceAI Support';

  await mailer.sendMail({
    from,
    to,
    subject: `${appLabel}: support executive invite`,
    text: `Hello,\n\n${invitedBy || 'Admin'} invited you to join as a support executive.\n\nAccept invite and set password: ${inviteLink}\n\nThis link expires in 48 hours.`,
    html: `<p>Hello,</p><p>${invitedBy || 'Admin'} invited you to join as a support executive.</p><p><a href="${inviteLink}">Accept invite and set password</a></p><p>This link expires in 48 hours.</p>`
  });
};
