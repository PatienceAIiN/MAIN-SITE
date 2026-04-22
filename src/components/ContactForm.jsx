import React, { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../common/fetchJson';

const ContactForm = ({ salesModal }) => {
  const formFields = salesModal?.fields || [];
  const initialForm = useMemo(
    () =>
      formFields.reduce((accumulator, field) => {
        accumulator[field.name] = '';
        return accumulator;
      }, {}),
    [formFields]
  );
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    setFormData(initialForm);
  }, [initialForm]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage('');

    try {
      const response = await fetchJson('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          source: salesModal?.source || 'sales'
        })
      });
      setStatusMessage(response?.message || salesModal?.statusMessages?.success || 'Message sent successfully.');
      setFormData(initialForm);
    } catch (error) {
      setStatusMessage(error.message || salesModal?.statusMessages?.error || 'Unable to send message right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const splitName = (value = '') => {
    const [firstName = '', ...rest] = value.trim().split(/\s+/);
    return { firstName, lastName: rest.join(' ') };
  };

  const { firstName, lastName } = splitName(formData.name || '');

  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-serif text-brand md:text-5xl">{salesModal?.title || 'Start the conversation.'}</h2>
          <p className="text-muted">{salesModal?.description || 'Reach out to our team to discover how PatienceAI can elevate your infrastructure.'}</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-brand">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(event) => {
                  const nextFirst = event.target.value;
                  setFormData((current) => ({ ...current, name: `${nextFirst} ${lastName}`.trim() }));
                }}
                className="w-full rounded-[4px] border border-gray-200 px-4 py-3 transition-colors focus:border-[#1a1a1a] focus:outline-none focus:ring-1 focus:ring-[#1a1a1a]"
                placeholder="Jane"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-brand">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(event) => {
                  const nextLast = event.target.value;
                  setFormData((current) => ({ ...current, name: `${firstName} ${nextLast}`.trim() }));
                }}
                className="w-full rounded-[4px] border border-gray-200 px-4 py-3 transition-colors focus:border-[#1a1a1a] focus:outline-none focus:ring-1 focus:ring-[#1a1a1a]"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-brand">Work Email</label>
            <input
              type="email"
              name="email"
              value={formData.email || ''}
              onChange={handleChange}
              className="w-full rounded-[4px] border border-gray-200 px-4 py-3 transition-colors focus:border-[#1a1a1a] focus:outline-none focus:ring-1 focus:ring-[#1a1a1a]"
              placeholder="jane@company.com"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-brand">Subject</label>
            <input
              type="text"
              name="subject"
              value={formData.subject || ''}
              onChange={handleChange}
              className="w-full rounded-[4px] border border-gray-200 px-4 py-3 transition-colors focus:border-[#1a1a1a] focus:outline-none focus:ring-1 focus:ring-[#1a1a1a]"
              placeholder="Tell us what you need"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-brand">Message</label>
            <textarea
              rows="4"
              name="message"
              value={formData.message || ''}
              onChange={handleChange}
              className="w-full rounded-[4px] border border-gray-200 px-4 py-3 transition-colors focus:border-[#1a1a1a] focus:outline-none focus:ring-1 focus:ring-[#1a1a1a]"
              placeholder="Tell us about your needs..."
              required
            />
          </div>

          {statusMessage ? <p className="text-sm text-[#666666]">{statusMessage}</p> : null}

          <button
            type="submit"
            className="w-full rounded-[4px] bg-[#1a1a1a] px-8 py-4 font-medium text-white transition-colors duration-300 hover:bg-black"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : salesModal?.submitButton?.idleLabel || 'Send Message'}
          </button>
        </form>
      </div>
    </section>
  );
};

export default ContactForm;
