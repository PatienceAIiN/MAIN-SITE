import React, { useEffect } from 'react';

const PrivacyPolicy = ({ content }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const title = content?.title || 'Privacy Policy';
  const updatedLabel = content?.updatedLabel || 'LAST UPDATED';
  const updatedValue = content?.updatedValue || '';
  const sections = Array.isArray(content?.sections) ? content.sections : [];

  return (
    <div className="flex flex-col w-full bg-white">
      <div className="pt-48 pb-16 px-6 bg-[#f4f4f4] text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="max-w-4xl mx-auto relative z-10 animate-fade-rise">
          <h1 className="text-5xl md:text-7xl font-sans tracking-tighter text-[#1a1a1a] mb-6 font-medium">{title}</h1>
          <p className="text-[#666666] font-medium tracking-wide">{updatedLabel}{updatedValue ? `: ${updatedValue}` : ''}</p>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-20 flex flex-col gap-10 animate-fade-rise-delay">
        {sections.map((section, index) => (
          <section key={`${section?.heading || 'section'}-${index}`}>
            {section?.heading && <h2 className="text-2xl font-sans font-medium text-[#1a1a1a] mb-4">{section.heading}</h2>}
            {Array.isArray(section?.paragraphs) &&
              section.paragraphs.map((paragraph, paragraphIndex) => (
                <p key={`paragraph-${paragraphIndex}`} className="text-[#4a4a4a] text-lg leading-relaxed mb-4 last:mb-0">
                  {paragraph}
                </p>
              ))}
            {Array.isArray(section?.bullets) && section.bullets.length > 0 && (
              <ul className="list-disc pl-6 text-[#4a4a4a] text-lg leading-relaxed flex flex-col gap-2">
                {section.bullets.map((bullet, bulletIndex) => (
                  <li key={`bullet-${bulletIndex}`}>{bullet}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
    </div>
  );
};

export default PrivacyPolicy;
