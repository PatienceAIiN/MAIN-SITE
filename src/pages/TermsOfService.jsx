import React, { useEffect } from 'react';

const TermsOfService = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex flex-col w-full bg-white">
      {/* Header */}
      <div className="pt-48 pb-16 px-6 bg-[#f4f4f4] text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
        <div className="max-w-4xl mx-auto relative z-10 animate-fade-rise">
          <h1 className="text-5xl md:text-7xl font-sans tracking-tighter text-[#1a1a1a] mb-6 font-medium">Terms of Service</h1>
          <p className="text-[#666666] font-medium tracking-wide">LAST UPDATED: AUGUST 2026</p>
        </div>
      </div>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-6 py-20 flex flex-col gap-10 animate-fade-rise-delay">
        <section>
          <p className="text-[#4a4a4a] text-lg leading-relaxed mb-6">
            Welcome to PatienceAI. By accessing our website and utilizing our services, you agree to be bound by the following Terms of Service. Please read them carefully before engaging with our platform or contracting our services.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-sans font-medium text-[#1a1a1a] mb-4">1. Acceptance of Terms</h2>
          <p className="text-[#4a4a4a] text-lg leading-relaxed">
            By accessing or using the PatienceAI website and services, you agree to comply with and be bound by these Terms. If you do not agree to these terms, you may not access or use our services.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-sans font-medium text-[#1a1a1a] mb-4">2. Description of Services</h2>
          <p className="text-[#4a4a4a] text-lg leading-relaxed">
            PatienceAI provides enterprise-grade technical solutions including, but not limited to, Digital Transformation, eCommerce Development, Cloud Infrastructure & DevOps, and Artificial Intelligence integrations. The specific scope, deliverables, and timelines for client projects are governed by separate master service agreements (MSAs) or statements of work (SOWs).
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-sans font-medium text-[#1a1a1a] mb-4">3. User Responsibilities</h2>
          <p className="text-[#4a4a4a] text-lg leading-relaxed mb-4">
            When interacting with our platform or team, you agree to:
          </p>
          <ul className="list-disc pl-6 text-[#4a4a4a] text-lg leading-relaxed flex flex-col gap-2">
            <li>Provide accurate and complete information when requesting audits, demos, or services.</li>
            <li>Maintain the confidentiality of any shared proprietary methodologies or systems demonstrated to you during consultations.</li>
            <li>Use our services only for lawful purposes and in accordance with applicable regulations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-sans font-medium text-[#1a1a1a] mb-4">4. Intellectual Property Rights</h2>
          <p className="text-[#4a4a4a] text-lg leading-relaxed">
            The content, design, graphics, and underlying code of the PatienceAI website are the intellectual property of PatienceAI. Any proprietary frameworks, AI models, or platforms developed by us remain our intellectual property unless explicitly transferred under a written agreement. Client data and client-specific code bases remain the property of the respective client.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-sans font-medium text-[#1a1a1a] mb-4">5. Limitation of Liability</h2>
          <p className="text-[#4a4a4a] text-lg leading-relaxed">
            To the maximum extent permitted by law, PatienceAI shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your access to or use of our website or general informational content.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-sans font-medium text-[#1a1a1a] mb-4">6. Governing Law</h2>
          <p className="text-[#4a4a4a] text-lg leading-relaxed">
            These Terms shall be governed by and construed in accordance with the laws of India, specifically within the jurisdiction of Pune, Maharashtra, without regard to its conflict of law provisions.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-sans font-medium text-[#1a1a1a] mb-4">7. Contact Information</h2>
          <p className="text-[#4a4a4a] text-lg leading-relaxed">
            If you have any questions about these Terms, please contact us at <a href="mailto:growth@patienceai.in" className="text-[#1a1a1a] underline font-medium">growth@patienceai.in</a>.
          </p>
        </section>
      </article>
    </div>
  );
};

export default TermsOfService;