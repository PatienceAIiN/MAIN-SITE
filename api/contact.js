import { queryDb, isMissingTableError } from './_db.js';

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');


const sendBrevoEmail = async ({ apiKey, sender, to, subject, htmlContent, replyTo }) => {
  const payload = {
    sender,
    to,
    subject,
    htmlContent
  };

  if (replyTo) {
    payload.replyTo = replyTo;
  }

  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(payload)
  });
};

const parseBrevoError = async (response) => {
  const fallback = `Brevo request failed with status ${response.status}`;
  try {
    const payload = await response.json();
    if (payload?.message) return payload.message;
    return JSON.stringify(payload);
  } catch {
    try {
      const text = await response.text();
      return text || fallback;
    } catch {
      return fallback;
    }
  }
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, subject, message, company, productName } = req.body || {};
  const source = req.body?.source || 'sales';

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required' });
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

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const CONTACT_TO_EMAIL_CONFIG = process.env.CONTACT_TO_EMAIL || process.env.RECIPIENT_EMAIL || '';
    const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || CONTACT_TO_EMAIL_CONFIG || 'noreply@patience.ai';
    const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'PATIENCE AI';
    const CONTACT_TO_EMAIL = CONTACT_TO_EMAIL_CONFIG || BREVO_SENDER_EMAIL;

    if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL || !CONTACT_TO_EMAIL) {
      console.error('Missing Brevo email configuration. Ensure BREVO_API_KEY, BREVO_SENDER_EMAIL, and CONTACT_TO_EMAIL are set.');
      return res.status(500).json({
        error: 'Email service is not configured. Please try again shortly.'
      });
    }

    const inquiryMeta = getInquiryMeta({ source, productName });
    const emailSubject = inquiryMeta.ownerSubject;
    const senderIdentity = {
      name: BREVO_SENDER_NAME,
      email: BREVO_SENDER_EMAIL
    };
    const ownerRecipient = [
      {
        email: CONTACT_TO_EMAIL,
        name: 'Patience AI Team'
      }
    ];
    const userRecipient = [
      {
        email,
        name
      }
    ];
    const summaryRows = [
      `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`,
      `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
      company ? `<p><strong>Company:</strong> ${escapeHtml(company)}</p>` : '',
      productName ? `<p><strong>Product:</strong> ${escapeHtml(productName)}</p>` : '',
      `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>`
    ]
      .filter(Boolean)
      .join('');

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

    const [ownerResponse, userResponse] = await Promise.all([
      sendBrevoEmail({
        apiKey: BREVO_API_KEY,
        sender: senderIdentity,
        to: ownerRecipient,
        subject: emailSubject,
        htmlContent: ownerHtml,
        replyTo: {
          email,
          name
        }
      }),
      sendBrevoEmail({
        apiKey: BREVO_API_KEY,
        sender: senderIdentity,
        to: userRecipient,
        subject: inquiryMeta.userSubject,
        htmlContent: userHtml,
        replyTo: {
          email: BREVO_SENDER_EMAIL,
          name: BREVO_SENDER_NAME
        }
      })
    ]);

    if (!ownerResponse.ok || !userResponse.ok) {
      const ownerError = !ownerResponse.ok ? await parseBrevoError(ownerResponse) : null;
      const userError = !userResponse.ok ? await parseBrevoError(userResponse) : null;
      const detail = ownerError || userError || 'Unknown Brevo error';
      console.error('Brevo API error:', detail);
      return res.status(502).json({
        error: 'Unable to send confirmation emails right now. Please retry in a moment.'
      });
    }

    return res.status(200).json({ message: 'Email sent successfully', emailSent: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(500).json({
      error: 'Unable to submit your request right now. Please try again.'
    });
  }
}
