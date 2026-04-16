import nodemailer from 'nodemailer';
import { queryDb, isMissingTableError } from './_db.js';

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeEmailAddress = (value = '') => {
  const input = String(value).trim();
  if (!input) return '';
  const angleMatch = input.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();
  return input.replace(/^mailto:/i, '').trim();
};

const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmailAddress(value));

const parseEmailList = (rawValue = '') => {
  const seen = new Set();
  return String(rawValue)
    .split(/[\s,;]+/)
    .map((entry) => normalizeEmailAddress(entry))
    .filter(Boolean)
    .filter((entry) => {
      const normalized = entry.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};

const getInquiryMeta = ({ source, productName }) => {
  if (source === 'job-inquiry-chat') {
    return {
      label: 'Job enquiry',
      accent: '#1a73e8',
      ownerSubject: 'New Job Enquiry from Website Chat',
      userSubject: 'Your job enquiry has been received',
      ownerSummary: 'A candidate submitted a hiring enquiry via the AI assistant.',
      userSummary: 'Thanks for your interest in careers at PATIENCE AI.'
    };
  }
  if (source === 'product-demo' && productName) {
    return {
      label: 'Product demo request',
      accent: '#0f9d58',
      ownerSubject: `Demo Request: ${productName}`,
      userSubject: `Your demo request for ${productName} is received`,
      ownerSummary: 'A prospect requested a product demo from the website.',
      userSummary: 'Thanks for requesting a demo. Our team will follow up shortly.'
    };
  }
  return {
    label: source === 'chatbot' ? 'Sales enquiry (AI assistant)' : 'Sales / Contact enquiry',
    accent: '#673ab7',
    ownerSubject: 'New Sales/Contact Enquiry from Website',
    userSubject: 'Thank you for contacting PATIENCE AI',
    ownerSummary: 'A visitor submitted a contact request from the website.',
    userSummary: 'Thanks for reaching out to our team.'
  };
};

const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtpout.secureserver.net';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE !== 'false'; // true for 465, false for 587

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, subject, message, company, productName } = req.body || {};
  const source = req.body?.source || 'sales';

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  try {
    try {
      await queryDb(
        `INSERT INTO contact_submissions (name, email, subject, message, company, product_name, source, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'new',NOW(),NOW())`,
        [name, email, subject, message, company || null, productName || null, source]
      );
    } catch (dbError) {
      if (!isMissingTableError(dbError.message)) {
        console.error('Neon insert error:', dbError.message);
      }
    }

    const SMTP_USER = (process.env.SMTP_USER || '').trim();
    const SMTP_PASS = (process.env.SMTP_PASS || '').trim();
    const SENDER_NAME = (process.env.SMTP_SENDER_NAME || 'PATIENCE AI').trim();
    const CONTACT_TO_EMAIL_CONFIG = process.env.CONTACT_TO_EMAIL || process.env.SMTP_TO_EMAIL || '';
    const CONTACT_TO_EMAILS = parseEmailList(CONTACT_TO_EMAIL_CONFIG).filter(isValidEmail);

    const configIssues = [];
    if (!SMTP_USER) configIssues.push('SMTP_USER is missing');
    if (!SMTP_PASS) configIssues.push('SMTP_PASS is missing');
    if (CONTACT_TO_EMAILS.length === 0) configIssues.push('CONTACT_TO_EMAIL must contain at least one valid recipient');

    if (configIssues.length > 0) {
      console.error('Missing SMTP configuration:', configIssues.join('; '));
      return res.status(200).json({
        message: 'Thanks. Your message is saved. Email delivery is temporarily unavailable.',
        emailSent: false,
        emailDebug: { configIssues }
      });
    }

    const inquiryMeta = getInquiryMeta({ source, productName });
    const normalizedUserEmail = normalizeEmailAddress(email);

    const summaryRows = [
      `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`,
      `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
      company ? `<p><strong>Company:</strong> ${escapeHtml(company)}</p>` : '',
      productName ? `<p><strong>Product:</strong> ${escapeHtml(productName)}</p>` : '',
      `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>`
    ].filter(Boolean).join('');

    const ownerHtml = `
      <div style="margin:0;background:#f6f9fc;padding:24px 12px;font-family:Arial,'Helvetica Neue',sans-serif;color:#202124;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <div style="padding:18px 22px;background:${inquiryMeta.accent};color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;">PATIENCE AI • ${escapeHtml(inquiryMeta.label)}</div>
            <h2 style="margin:8px 0 4px;font-size:22px;line-height:1.3;">${escapeHtml(inquiryMeta.ownerSubject)}</h2>
            <p style="margin:0;font-size:14px;opacity:0.92;">${escapeHtml(inquiryMeta.ownerSummary)}</p>
          </div>
          <div style="padding:20px 22px;">
            <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;">
              ${summaryRows}
              <p><strong>Source:</strong> ${escapeHtml(source)}</p>
            </div>
            <div style="margin-top:14px;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#5f6368;">Message</p>
              <p style="margin:0;color:#334155;white-space:pre-wrap;line-height:1.6;">${escapeHtml(message)}</p>
            </div>
            <p style="margin:16px 0 0;font-size:12px;color:#5f6368;">Sent on ${new Date().toLocaleString()}.</p>
          </div>
        </div>
      </div>
    `;

    const userHtml = `
      <div style="margin:0;background:#f6f9fc;padding:24px 12px;font-family:Arial,'Helvetica Neue',sans-serif;color:#202124;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <div style="padding:18px 22px;background:#ffffff;border-bottom:1px solid #e5e7eb;">
            <h2 style="margin:0;font-size:22px;line-height:1.3;color:#111827;">${escapeHtml(inquiryMeta.userSubject)}</h2>
            <p style="margin:8px 0 0;color:#4b5563;line-height:1.6;">Hi ${escapeHtml(name)}, ${escapeHtml(inquiryMeta.userSummary)}</p>
          </div>
          <div style="padding:20px 22px;">
            <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#5f6368;">Your submission copy</p>
              ${productName ? `<p><strong>Product:</strong> ${escapeHtml(productName)}</p>` : ''}
              <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
              <p style="margin:0 0 6px;"><strong>Message:</strong></p>
              <p style="margin:0;color:#334155;white-space:pre-wrap;line-height:1.6;">${escapeHtml(message)}</p>
            </div>
            <p style="margin:14px 0 0;color:#4b5563;line-height:1.6;">If you need to add more details, simply reply to this email.</p>
          </div>
        </div>
      </div>
    `;

    const transporter = createTransporter();
    const fromAddress = `"${SENDER_NAME}" <${SMTP_USER}>`;

    let ownerEmailSent = false;
    let userConfirmationSent = false;
    let ownerError;
    let userError;

    try {
      await transporter.sendMail({
        from: fromAddress,
        to: CONTACT_TO_EMAILS.join(', '),
        replyTo: isValidEmail(normalizedUserEmail) ? `"${name.trim()}" <${normalizedUserEmail}>` : undefined,
        subject: inquiryMeta.ownerSubject,
        html: ownerHtml
      });
      ownerEmailSent = true;
    } catch (err) {
      ownerError = err.message;
      console.error('Owner email error:', err.message);
    }

    try {
      if (isValidEmail(normalizedUserEmail)) {
        await transporter.sendMail({
          from: fromAddress,
          to: `"${name.trim()}" <${normalizedUserEmail}>`,
          replyTo: fromAddress,
          subject: inquiryMeta.userSubject,
          html: userHtml
        });
        userConfirmationSent = true;
      }
    } catch (err) {
      userError = err.message;
      console.error('User confirmation email error:', err.message);
    }

    if (!ownerEmailSent && !userConfirmationSent) {
      return res.status(200).json({
        message: 'Thanks. Your message is saved but email delivery failed. Please try again later.',
        emailSent: false,
        userConfirmationSent: false,
        emailDebug: { ownerError, userError }
      });
    }

    if (!ownerEmailSent) {
      return res.status(200).json({
        message: 'Confirmation email sent to you, but team notification failed.',
        emailSent: false,
        userConfirmationSent: true,
        emailDebug: { ownerError }
      });
    }

    if (!userConfirmationSent) {
      return res.status(200).json({
        message: 'Message sent to our team, but confirmation email to you failed.',
        emailSent: true,
        userConfirmationSent: false,
        emailDebug: { userError }
      });
    }

    return res.status(200).json({ message: 'Email sent successfully', emailSent: true, userConfirmationSent: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(200).json({
      message: 'Thanks. Your message is saved. We will follow up shortly.',
      emailSent: false
    });
  }
}
