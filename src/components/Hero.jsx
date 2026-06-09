import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const Hero = () => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

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
            <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4" type="video/mp4" />
          </video>
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white pointer-events-none"></div>
        </div>
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-7xl mx-auto w-full">
        <h1 className="text-[40px] sm:text-[52px] md:text-[68px] w-full font-normal font-serif text-[#000000] animate-fade-rise opacity-0 leading-[0.95] tracking-[-1.5px]">
          Beyond <span className="italic text-[#333333]">silence,</span> we build <br className="hidden md:block" /> <span className="italic text-[#333333]">the eternal.</span>
        </h1>
        
        <p className="text-base sm:text-lg max-w-2xl mt-8 leading-relaxed text-[#1a1a1a] font-medium animate-fade-rise-delay opacity-0">
          Building platforms for brilliant minds, fearless makers, and thoughtful souls. Through the noise, we craft digital havens for deep work and pure flows.
        </p>
        
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