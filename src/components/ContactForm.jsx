import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import FadeIn from '../common/FadeIn';
import { fetchJson } from '../common/fetchJson';
import FormStatus from './FormStatus';

const DEFAULT_HIGHLIGHTS = [
  'Routed directly to the right product owner',
  'Confidential — used only to reply to your message',
  'Typical response time: under one business day'
];

const ContactForm = ({ salesModal }) => {
  const navigate = useNavigate();
  const fieldNamesKey = (salesModal?.fields || []).map((f) => f.name).join('|');
  const initialForm = useMemo(
    () =>
      (salesModal?.fields || []).reduce((accumulator, field) => {
        accumulator[field.name] = '';
        return accumulator;
      }, {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldNamesKey]
  );
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('');
    setSubmitMessage('');

    try {
      const response = await fetchJson('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          source: salesModal?.source || 'sales'
        })
      });
      setSubmitStatus('success');
      setSubmitMessage(response?.message || salesModal?.statusMessages?.success || 'Message sent successfully.');
      setFormData(initialForm);
    } catch (error) {
      setSubmitStatus('error');
      setSubmitMessage(error.message || salesModal?.statusMessages?.error || 'Unable to send message right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const splitName = (value = '') => {
    const [firstName = '', ...rest] = value.trim().split(/\s+/);
    return { firstName, lastName: rest.join(' ') };
  };

  const { firstName, lastName } = splitName(formData.name || '');

  const title = salesModal?.title || 'Start the conversation.';
  const description = salesModal?.description || 'Reach out to our team to discover how Patience AI can elevate your infrastructure.';
  const highlights = salesModal?.highlights?.length ? salesModal.highlights : DEFAULT_HIGHLIGHTS;
  const submitLabel = salesModal?.submitButton?.idleLabel || 'Send Message';
  const successMessage = submitMessage || salesModal?.statusMessages?.success || "Thanks — we'll get back to you shortly.";
  const errorMessage = submitMessage || salesModal?.statusMessages?.error || 'Unable to send message right now.';

  return (
    <section className="mx-auto grid max-w-7xl gap-8 px-6 py-24 lg:grid-cols-[0.92fr_1.08fr] md:py-32">
      <FadeIn direction="left" className="rounded-[24px] border border-[#e5e5e5] bg-[#f4f4f4] p-8">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-[#a3a3a3]">Inquiry</p>
        <h2 className="mb-4 text-3xl font-medium tracking-tight text-[#1a1a1a]">{title}</h2>
        <p className="mb-8 leading-relaxed text-[#666666]">{description}</p>

        <div className="space-y-3">
          {highlights.map((item) => (
            <div key={item} className="rounded-2xl border border-[#e5e5e5] bg-white px-5 py-4">
              <p className="leading-relaxed text-[#4a4a4a]">{item}</p>
            </div>
          ))}
        </div>
      </FadeIn>

      <FadeIn direction="right" className="rounded-[24px] border border-[#e5e5e5] bg-white p-8 shadow-sm">
        <AnimatePresence mode="wait">
          {submitStatus === 'success' ? (
            <motion.div
              key="contact-success"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="rounded-[24px] border border-[#e5e5e5] bg-[#f4f4f4] p-8"
            >
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-semibold text-emerald-700">
                ✓
              </div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-emerald-600">Sent</p>
              <h3 className="mb-3 text-2xl font-medium text-[#1a1a1a]">Message received</h3>
              <p className="mb-8 leading-relaxed text-[#666666]">{successMessage}</p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => { setSubmitStatus(''); setSubmitMessage(''); }}
                  className="rounded-full bg-[#1a1a1a] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
                >
                  Send another message
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/products')}
                  className="rounded-full border border-[#d1d1d1] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#1a1a1a] transition-colors hover:border-[#1a1a1a]"
                >
                  View products
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="contact-form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-[#1a1a1a]">First name</label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(event) => {
                      const nextFirst = event.target.value;
                      setFormData((current) => ({ ...current, name: `${nextFirst} ${lastName}`.trim() }));
                    }}
                    placeholder="Jane"
                    className="w-full rounded-[20px] border border-[#d1d1d1] bg-white px-4 py-3.5 text-[#1a1a1a] placeholder:text-[#a3a3a3] focus:border-[#1a1a1a] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-[#1a1a1a]">Last name</label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(event) => {
                      const nextLast = event.target.value;
                      setFormData((current) => ({ ...current, name: `${firstName} ${nextLast}`.trim() }));
                    }}
                    placeholder="Doe"
                    className="w-full rounded-[20px] border border-[#d1d1d1] bg-white px-4 py-3.5 text-[#1a1a1a] placeholder:text-[#a3a3a3] focus:border-[#1a1a1a] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#1a1a1a]">Work email</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  value={formData.email || ''}
                  onChange={handleChange}
                  placeholder="jane@company.com"
                  className="w-full rounded-[20px] border border-[#d1d1d1] bg-white px-4 py-3.5 text-[#1a1a1a] placeholder:text-[#a3a3a3] focus:border-[#1a1a1a] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="subject" className="mb-2 block text-sm font-medium text-[#1a1a1a]">Subject</label>
                <input
                  id="subject"
                  type="text"
                  name="subject"
                  required
                  value={formData.subject || ''}
                  onChange={handleChange}
                  placeholder="Tell us what you need"
                  className="w-full rounded-[20px] border border-[#d1d1d1] bg-white px-4 py-3.5 text-[#1a1a1a] placeholder:text-[#a3a3a3] focus:border-[#1a1a1a] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="message" className="mb-2 block text-sm font-medium text-[#1a1a1a]">Message</label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  value={formData.message || ''}
                  onChange={handleChange}
                  placeholder="Tell us about your needs..."
                  className="w-full rounded-[20px] border border-[#d1d1d1] bg-white px-4 py-3.5 text-[#1a1a1a] placeholder:text-[#a3a3a3] focus:border-[#1a1a1a] focus:outline-none"
                />
              </div>

              <FormStatus
                status={submitStatus === 'error' ? 'error' : null}
                title="Submission failed"
                message={errorMessage}
                onDismiss={() => { setSubmitStatus(''); setSubmitMessage(''); }}
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1a1a1a] px-8 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Sending…' : submitLabel}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </FadeIn>
    </section>
  );
};

export default ContactForm;
