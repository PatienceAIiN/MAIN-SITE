import React, { useEffect } from 'react';

const PrivacyPolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex flex-col w-full bg-white">
      {/* Header */}
      <div className="pt-48 pb-16 px-6 bg-[#f4f4f4] text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        <div className="max-w-4xl mx-auto relative z-10 animate-fade-rise">
          <h1 className="text-5xl md:text-7xl font-sans tracking-tighter text-[#1a1a1a] mb-6 font-medium">Privacy Policy</h1>
          <p className="text-[#666666] font-medium tracking-wide">LAST UPDATED: AUGUST 2026</p>
        </div>
      </div>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-6 py-20 flex flex-col gap-10 animate-fade-rise-delay">
        <section>
          <p className="text-[#4a4a4a] text-lg leading-relaxed mb-6">
            At PatienceAI, we are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy outlines how we collect, use, and safeguard the data you provide to us when accessing our website and utilizing our digital transformation, eCommerce, Cloud/DevOps, and AI services.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-sans font-medium text-[#1a1a1a] mb-4">1. Information We Collect</h2>
          <p className="text-[#4a4a4a] text-lg leading-relaxed mb-4">
            We collect information to provide better services to all our users. The types of personal information we collect may include:
          </p>
          <ul className="list-disc pl-6 text-[#4a4a4a] text-lg leading-relaxed flex flex-col gap-2">
            <li><strong>Contact Information:</strong> Name, email address, phone number, and company details when you fill out contact forms or request a demo.</li>
            <li><strong>Usage Data:</strong> Information on how you interact with our website, including IP addresses, browser types, and pages visited, collected via cookies and analytics tools.</li>
            <li><strong>Service Data:</strong> Data provided securely during the execution of our services to audit, consult, or build infrastructure on your behalf.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-sans font-medium text-[#1a1a1a] mb-4">2. How We Use Your Information</h2>
          <p className="text-[#4a4a4a] text-lg leading-relaxed mb-4">
            The data we collect is strictly used to enhance your experience and deliver our services:
          </p>
          <ul className="list-disc pl-6 text-[#4a4a4a] text-lg leading-relaxed flex flex-col gap-2">
            <li>To provide, maintain, and improve our technical solutions.</li>
            <li>To communicate with you regarding project updates, support, and promotional materials (only if opted-in).</li>
            <li>To analyze site usage to optimize our website's performance and design.</li>
            <li>To comply with legal obligations and enforce our terms of service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-sans font-medium text-[#1a1a1a] mb-4">3. Data Sharing and Security</h2>
          <p className="text-[#4a4a4a] text-lg leading-relaxed mb-4">
            We do not sell, trade, or rent your personal information to third parties. We may share generic aggregated demographic information not linked to any personal identification information regarding visitors and users with our business partners.
          </p>
          <p className="text-[#4a4a4a] text-lg leading-relaxed">
            We adopt appropriate data collection, storage, and processing practices and security measures to protect against unauthorized access, alteration, disclosure, or destruction of your personal information.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-sans font-medium text-[#1a1a1a] mb-4">4. Your Data Rights</h2>
          <p className="text-[#4a4a4a] text-lg leading-relaxed">
            Depending on your location, you may have the right to access, update, or delete the information we have on you. If you wish to exercise these rights, please contact us at <a href="mailto:growth@patienceai.in" className="text-[#1a1a1a] underline font-medium">growth@patienceai.in</a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-sans font-medium text-[#1a1a1a] mb-4">5. Changes to This Policy</h2>
          <p className="text-[#4a4a4a] text-lg leading-relaxed">
            PatienceAI has the discretion to update this privacy policy at any time. When we do, we will revise the updated date at the top of this page. We encourage Users to frequently check this page for any changes to stay informed about how we are helping to protect the personal information we collect.
          </p>
        </section>
      </article>
    </div>
  );
};

export default PrivacyPolicy;