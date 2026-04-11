# Vercel Deployment Guide

## Environment Variables

Add these environment variables to your Vercel project:

### Required Variables

1. **BREVO_API_KEY**
   - Your Brevo API key
   - Get this from your Brevo dashboard: Settings > API Keys
   - Type: Secret

2. **BREVO_SENDER_EMAIL**
   - Verified sender email in Brevo
   - Example: `noreply@yourdomain.com`
   - Type: Plain

3. **BREVO_SENDER_NAME**
   - Display name used in outgoing emails
   - Example: `PATIENCE AI`
   - Type: Plain

4. **CONTACT_TO_EMAIL**
   - Email address where contact form submissions will be sent
   - Example: `hello@patience.ai`
   - Type: Plain

5. **SUPABASE_URL**
   - Supabase project URL
   - Type: Plain

6. **SUPABASE_SERVICE_ROLE_KEY**
   - Supabase service role key for server-side admin operations
   - Type: Secret

7. **ADMIN_SESSION_SECRET**
   - Long random secret used to sign admin sessions
   - Type: Secret

8. **ADMIN_USERNAME**
   - Admin panel username (stored only in environment, not database)
   - Example: `patience-admin`
   - Type: Plain

9. **ADMIN_PASSWORD**
   - Admin panel password (stored only in environment, not database)
   - Example: use a long random password
   - Type: Secret

10. **GROQ_API_KEY**
   - Groq API key for AI chatbot answers
   - Get this from Groq Console
   - Type: Secret

11. **GROQ_MODEL**
   - Optional Groq model id
   - Default: `llama-3.3-70b-versatile`
   - Type: Plain

12. **SITE_URL**
   - Optional site URL used in deployment and emails
   - Example: `https://your-domain.com`
   - Type: Plain

## Setup Steps

### 1. Brevo Configuration

1. Sign up for a Brevo account at [https://www.brevo.com](https://www.brevo.com)
2. Verify your sender domain/email in Brevo dashboard
3. Generate an API key:
   - Go to Settings > API Keys
   - Click "Generate new key"
   - Give it a name (e.g., "Website Contact Form")
   - Copy the key and add it to Vercel

### 2. Supabase Configuration

1. Create a Supabase project
2. Run `supabase/schema.sql`
3. Add the Supabase URL and service role key to Vercel

### 3. Vercel Deployment

1. Connect your repository to Vercel
2. Add the environment variables above
3. Deploy your application

### 4. Testing

After deployment, test both contact and chat flows:
1. Navigate to the `/#contacts` section
2. Fill out the form with valid data
3. Submit and check if emails are received
4. Open the bottom-right chat bubble and ask 2-3 site-related questions
5. Confirm answers are returned and `chatbot_messages` receives rows in Supabase

## Local Development

For local development:

1. Copy `.env.example` to `.env.local`
2. Add your Brevo API key and email configuration
3. Run `npm run dev`

## Troubleshooting

### Common Issues

1. **Email not sending**
   - Check if BREVO_API_KEY is correct
   - Verify sender email is registered in Brevo
   - Check Vercel function logs

2. **Form submission error**
   - Ensure all fields are filled
   - Check network tab for API errors
   - Verify CORS is properly configured

3. **Environment variables not working**
   - Make sure variables are added to Vercel (not just locally)
   - Check variable names match exactly
   - Restart deployment after adding variables

## Security Notes

- Never expose your Brevo API key in client-side code
- Always use environment variables for sensitive data
- Consider implementing rate limiting for the contact form
- Add input validation and sanitization

## Features Included

- Contact form with validation
- Email notifications to admin and submitter
- Auto-response to user
- Error handling and user feedback
- Responsive design
- Loading states
- Modern UI with Tailwind CSS
- Database-backed admin content management
- JSON-seeded site content with Supabase persistence
