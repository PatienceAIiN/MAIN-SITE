import React, { useMemo, useState } from 'react';
import ContactForm from '../components/ContactForm';

const ContactPage = ({ siteContent }) => {
  const [activeForm, setActiveForm] = useState('contact');
  const salesModal = siteContent?.salesModal;

  const contactConfig = useMemo(
    () => ({
      ...salesModal,
      title: 'Contact Form',
      description: 'Share your query and our team will route it to the right owner.',
      source: 'contact',
      submitButton: {
        ...(salesModal?.submitButton || {}),
        idleLabel: 'Send Contact Request'
      }
    }),
    [salesModal]
  );

  const activeConfig = activeForm === 'sales' ? salesModal : contactConfig;

  return (
    <div className="flex flex-col w-full bg-white pt-24">
      <div className="mx-auto mt-8 flex w-full max-w-3xl gap-3 px-6">
        <button
          type="button"
          onClick={() => setActiveForm('contact')}
          className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
            activeForm === 'contact'
              ? 'bg-[#1a1a1a] text-white'
              : 'border border-gray-300 text-[#1a1a1a] hover:border-[#1a1a1a]'
          }`}
        >
          Contact Form
        </button>
        <button
          type="button"
          onClick={() => setActiveForm('sales')}
          className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
            activeForm === 'sales'
              ? 'bg-[#1a1a1a] text-white'
              : 'border border-gray-300 text-[#1a1a1a] hover:border-[#1a1a1a]'
          }`}
        >
          Sales
        </button>
      </div>
      <ContactForm salesModal={activeConfig} />
    </div>
  );
};

export default ContactPage;
