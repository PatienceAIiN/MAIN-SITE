import React, { useEffect, useRef } from 'react';

const VIDEO_SOURCE =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4';

const Hero = ({ content, onAction }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let animationFrameId;
    const video = videoRef.current;
    const container = containerRef.current;

    if (!video || !container) {
      return undefined;
    }

    const updateOpacity = () => {
      if (video.readyState < 3) {
        animationFrameId = window.requestAnimationFrame(updateOpacity);
        return;
      }

      const duration = video.duration;
      const currentTime = video.currentTime;
      let opacity = 1;

      if (currentTime < 0.5) {
        opacity = currentTime / 0.5;
      } else if (duration > 0 && currentTime > duration - 0.5) {
        opacity = Math.max(0, (duration - currentTime) / 0.5);
      }

      container.style.opacity = `${opacity}`;
      animationFrameId = window.requestAnimationFrame(updateOpacity);
    };

    const handlePlay = () => {
      animationFrameId = window.requestAnimationFrame(updateOpacity);
    };

    video.addEventListener('play', handlePlay);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      video.removeEventListener('play', handlePlay);
    };
  }, []);

  return (
    <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-white px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28">
      <div className="absolute inset-x-0 bottom-0 top-[10rem] z-0">
        <div ref={containerRef} className="relative h-full w-full opacity-0 transition-opacity duration-150">
          <video ref={videoRef} autoPlay muted playsInline loop className="h-full w-full object-cover">
            <source src={VIDEO_SOURCE} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/25 to-white" />
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center text-center">
        <p className="mb-6 rounded-full border border-[#d1d1d1] bg-white/90 px-4 py-1.5 text-sm font-medium text-[#666666] shadow-sm">
          Product-first AI systems
        </p>
        <h1 className="max-w-6xl text-balance font-serif text-[2rem] font-normal leading-[1.04] tracking-[-0.05em] text-[#1a1a1a] sm:text-6xl md:text-7xl">
          {content.headline}
        </h1>
        <p className="mt-8 max-w-2xl text-base leading-relaxed text-[#4a4a4a] sm:text-lg">
          {content.description}
        </p>
        <button
          type="button"
          onClick={() => onAction(content.cta.action)}
          className="mt-10 inline-flex w-full items-center justify-center rounded-full bg-[#1a1a1a] px-8 py-4 text-base font-medium text-white shadow-xl transition-transform duration-300 hover:scale-[1.03] sm:mt-12 sm:w-auto sm:px-14 sm:py-5"
        >
          {content.cta.label}
        </button>
      </div>
    </section>
  );
};

export default Hero;
