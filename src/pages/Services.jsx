import React from 'react';
import FAQSection from '../components/FAQSection';
import FinalCTA from '../components/FinalCTA';

const Services = ({ siteContent }) => {
  const serviceCards = siteContent?.platformPage?.cards || [];
  const possibilityItems = siteContent?.possibilities?.items || [];

  return (
    <div className="flex w-full flex-col bg-white">
      <div className="relative overflow-hidden bg-[#f4f4f4] px-6 pb-20 pt-48 text-center md:pb-32">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />

        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="mb-8 inline-block rounded-full border border-[#d1d1d1] bg-white px-4 py-1.5 text-sm font-medium text-[#1a1a1a] shadow-sm animate-fade-rise">
            {siteContent?.platformPage?.hero?.eyebrow || 'Capabilities'}
          </div>
          <h1 className="mb-8 text-5xl font-serif leading-[1.05] tracking-tight text-[#1a1a1a] md:text-7xl lg:text-[5.5rem]">
            {siteContent?.platformPage?.hero?.title || 'Our Services'}
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-[#666666] md:text-xl">
            {siteContent?.platformPage?.hero?.description || 'A unified ecosystem for brilliant minds and fearless makers. Explore our comprehensive suite of technical capabilities designed to scale your enterprise.'}
          </p>
        </div>
      </div>

      <section className="mx-auto w-full max-w-7xl px-6 py-24 md:py-32">
        <div className="grid grid-cols-1 gap-8 md:gap-12 lg:grid-cols-2">
          {serviceCards.map((service, index) => (
            <div
              key={service.title}
              className="group flex flex-col overflow-hidden rounded-[24px] border border-[#e5e5e5] bg-white shadow-sm transition-all duration-500 hover:border-[#d1d1d1] hover:shadow-xl"
            >
              <div className="relative h-64 w-full overflow-hidden bg-[#f4f4f4] md:h-80">
                <img
                  src={possibilityItems[index]?.img || `https://images.unsplash.com/photo-${index === 0 ? '1504384308090-c894fdcc538d' : index === 1 ? '1556742049-0cfed4f6a45d' : '1451187580459-43490279c0fa'}?q=80&w=2070&auto=format&fit=crop`}
                  alt={service.title}
                  className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105 group-hover:grayscale-0"
                />
              </div>

              <div className="flex flex-grow flex-col p-8 md:p-10">
                <h3 className="mb-4 text-3xl font-medium tracking-tight text-[#1a1a1a]">{service.title}</h3>
                <p className="mb-10 text-base leading-relaxed text-[#666666] md:text-lg">{service.description}</p>

                <div className="mt-auto">
                  <div className="mb-6 flex items-center gap-4">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a3a3a3]">Capabilities</span>
                    <div className="h-[1px] flex-1 bg-[#e5e5e5]" />
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    {(service.points || []).map((point) => (
                      <span key={point.title} className="rounded-full border border-[#d1d1d1] bg-[#fdfdfd] px-3.5 py-1.5 text-[12px] font-medium text-[#666666] transition-colors group-hover:border-[#a3a3a3]">
                        {point.title}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <FAQSection />
      <FinalCTA />
    </div>
  );
};

export default Services;
