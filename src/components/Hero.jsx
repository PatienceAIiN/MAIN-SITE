import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const ROTATING_LINES = [
  'AI agents that resolve support conversations, not just deflect them.',
  'Voice assistants that sound human and reply in milliseconds.',
  'Answers grounded in your own documents, with citations you can trust.',
  'Workflows that quietly automate the busywork, end to end.'
];

const Hero = () => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setLineIndex((current) => (current + 1) % ROTATING_LINES.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let animationFrameId;
    const video = videoRef.current;
    const container = containerRef.current;

    if (!video || !container) return;

    const updateOpacity = () => {
      // Ensure video is ready before retrieving duration
      if (video.readyState < 3) {
        animationFrameId = requestAnimationFrame(updateOpacity);
        return;
      }

      const duration = video.duration;
      const currentTime = video.currentTime;
      let opacity = 1;

      // Fade in over 0.5s at the start
      if (currentTime < 0.5) {
        opacity = currentTime / 0.5;
      } 
      // Fade out over 0.5s before the end
      else if (duration > 0 && currentTime > duration - 0.5) {
        opacity = Math.max(0, (duration - currentTime) / 0.5);
      }

      container.style.opacity = opacity.toString();
      animationFrameId = requestAnimationFrame(updateOpacity);
    };

    const handlePlay = () => {
      animationFrameId = requestAnimationFrame(updateOpacity);
    };

    video.addEventListener('play', handlePlay);

    return () => {
      cancelAnimationFrame(animationFrameId);
      video.removeEventListener('play', handlePlay);
    };
  }, []);

  const handleEnded = () => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (video && container) {
      container.style.opacity = '0';
      setTimeout(() => {
        video.currentTime = 0;
        video.play();
      }, 100);
    }
  };

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-white pt-[160px] pb-40 flex flex-col items-center justify-center">
      {/* Video Background Layer */}
      <div className="absolute z-0 w-full" style={{ top: '300px', inset: 'auto 0 0 0' }}>
        <div ref={containerRef} className="w-full h-full relative transition-opacity duration-100 opacity-0">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            onEnded={handleEnded} 
            className="w-full h-full object-cover"
          >
            <source src="https://videos.pexels.com/video-files/5590919/5590919-sd_960_540_30fps.mp4" type="video/mp4" />
          </video>
          {/* Gradient Overlay — light wash so the colorful video stays vivid yet text stays readable */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/15 to-white pointer-events-none"></div>
        </div>
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-7xl mx-auto w-full">
        <h1 className="text-[40px] sm:text-[52px] md:text-[68px] w-full font-normal font-serif text-[#000000] animate-fade-rise opacity-0 leading-[0.95] tracking-[-1.5px]">
          Beyond the <span className="italic text-[#333333]">noise,</span> we build <br className="hidden md:block" /> what truly <span className="italic text-[#333333]">lasts.</span>
        </h1>

        <p className="text-base sm:text-lg max-w-2xl mt-8 leading-relaxed text-[#1a1a1a] font-medium animate-fade-rise-delay opacity-0">
          We craft platforms for bold builders and deep thinkers — calm, focused spaces where great work flows and ideas endure.
        </p>

        <div className="mt-6 h-7 max-w-2xl animate-fade-rise-delay-2 opacity-0">
          <p key={lineIndex} className="text-sm sm:text-base italic text-[#555555] animate-fade-rise">
            {ROTATING_LINES[lineIndex]}
          </p>
        </div>
        
        <Link 
          to="/company/contact" 
          className="bg-[#000000] text-[#FFFFFF] rounded-full px-14 py-5 text-base mt-12 hover:scale-[1.03] transition-transform duration-300 animate-fade-rise-delay-2 opacity-0 font-medium inline-block text-center"
        >
          Begin Journey
        </Link>
      </div>
    </section>
  );
};

export default Hero;