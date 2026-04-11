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
    const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@yourdomain.com';
    const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'PATIENCE AI';
    const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || process.env.RECIPIENT_EMAIL || 'hello@patience.ai';

    if (!BREVO_API_KEY) {
      return res.status(500).json({ error: 'Email service not configured' });
    }

    const isProductDemo = source === 'product-demo';
    const emailSubject =
      isProductDemo && productName ? `Demo Request: ${productName}` : `New Contact Form Submission: ${subject}`;
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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #111827; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">New Contact Form Submission</h2>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          ${summaryRows}
        </div>
        <div style="background-color: #fff; padding: 15px; border-left: 4px solid #4F46E5; margin: 20px 0;">
          <h3 style="color: #111827; margin-top: 0;">Message:</h3>
          <p style="color: #4b5563; white-space: pre-wrap;">${escapeHtml(message)}</p>
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p>This email was sent from the PATIENCE AI contact form.</p>
          <p>Sent on: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    const userHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #111827; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">Thanks for reaching out</h2>
        <p style="color: #4b5563; line-height: 1.6;">Dear ${escapeHtml(name)},</p>
        <p style="color: #4b5563; line-height: 1.6;">We have received your message and will review it shortly.</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          ${productName ? `<p><strong>Product:</strong> ${escapeHtml(productName)}</p>` : ''}
          <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
          <p><strong>Message:</strong></p>
          <p style="color: #4b5563; white-space: pre-wrap; font-style: italic;">${escapeHtml(message)}</p>
        </div>
        <p style="color: #4b5563; line-height: 1.6;">Reply to this email if you want to add context or share files.</p>
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
        subject: isProductDemo && productName
          ? `Your demo request for ${productName} is received`
          : 'Thank you for contacting PATIENCE AI',
        htmlContent: userHtml,
        replyTo: {
          email: BREVO_SENDER_EMAIL,
          name: BREVO_SENDER_NAME
        }
      })
    ]);

    if (!ownerResponse.ok || !userResponse.ok) {
      const ownerError = !ownerResponse.ok ? await ownerResponse.json().catch(() => ({})) : null;
      const userError = !userResponse.ok ? await userResponse.json().catch(() => ({})) : null;
      console.error('Brevo API error:', ownerError || userError);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
