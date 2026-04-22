import React from 'react';
import ContactForm from '../components/ContactForm';

const ContactPage = ({ siteContent }) => {
  return (
    <div className="flex flex-col w-full bg-white pt-24">
      <ContactForm salesModal={siteContent?.salesModal} />
    </div>
  );
};

export default ContactPage;
