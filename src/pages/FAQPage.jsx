import React, { useEffect, useRef } from 'react';
import FAQSection from '../components/FAQSection';

const VIDEO_SOURCE =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4';

const FAQPage = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.style.opacity = '1';
    }
  }, []);

  return (
    <div className="flex flex-col w-full">
      {/* Cover with live background video */}
      <section className="relative w-full overflow-hidden bg-white pt-[160px] pb-32 flex flex-col items-center justify-center">
        <div className="absolute inset-0 z-0">
          <div ref={containerRef} className="w-full h-full relative transition-opacity duration-500 opacity-0">
            <video autoPlay muted playsInline loop className="w-full h-full object-cover">
              <source src={VIDEO_SOURCE} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-white/60 pointer-events-none"></div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-7xl mx-auto w-full">
          <h1 className="text-[40px] sm:text-[52px] md:text-[68px] w-full font-normal font-serif text-[#000000] animate-fade-rise opacity-0 leading-[0.95] tracking-[-1.5px]">
            Frequently Asked <span className="italic text-[#333333]">Questions</span>
          </h1>
          <p className="text-base sm:text-lg max-w-2xl mt-8 leading-relaxed text-[#1a1a1a] font-medium animate-fade-rise-delay opacity-0">
            Everything you need to know about how we build, ship, and support intelligent systems.
          </p>
        </div>
      </section>

      <FAQSection />
    </div>
  );
};

export default FAQPage;
