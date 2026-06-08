import React, { useEffect } from 'react';
import PageHero from '../components/PageHero';

const TermsOfService = ({ content }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const title = content?.title || 'Terms of Service';
  const updatedLabel = content?.updatedLabel || 'LAST UPDATED';
  const updatedValue = content?.updatedValue || '';
  const sections = Array.isArray(content?.sections) ? content.sections : [];

  return (
    <div className="flex flex-col w-full bg-white">
      <PageHero
        eyebrow={`${updatedLabel}${updatedValue ? `: ${updatedValue}` : ''}`}
        title={title}
        coverImage="https://images.unsplash.com/photo-1589994965851-a8f479c573a9?q=80&w=2000&auto=format&fit=crop"
      />

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

export default TermsOfService;
