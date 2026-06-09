import React, { useEffect, useRef } from 'react';
import FAQSection from '../components/FAQSection';

const VIDEO_SOURCE =
  'https://videos.pexels.com/video-files/3141207/3141207-sd_640_360_25fps.mp4';

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
      <section className="relative w-full overflow-hidden bg-[#1a1a1a] pt-[160px] pb-32 flex flex-col items-center justify-center">
        <div className="absolute inset-0 z-0">
          <div ref={containerRef} className="w-full h-full relative transition-opacity duration-500 opacity-0">
            <video autoPlay muted playsInline loop preload="metadata" className="w-full h-full object-cover">
              <source src={VIDEO_SOURCE} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-black/55 pointer-events-none"></div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-7xl mx-auto w-full">
          <h1 className="text-[40px] sm:text-[52px] md:text-[68px] w-full font-normal font-serif text-white animate-fade-rise opacity-0 leading-[0.95] tracking-[-1.5px]">
            Frequently Asked <span className="italic text-white/70">Questions</span>
          </h1>
          <p className="text-base sm:text-lg max-w-2xl mt-8 leading-relaxed text-white/80 font-medium animate-fade-rise-delay opacity-0">
            Everything you need to know about how we build, ship, and support intelligent systems.
          </p>
        </div>
      </section>

      <FAQSection />
    </div>
  );
};

export default FAQPage;
