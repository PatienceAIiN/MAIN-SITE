import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Hls from 'hls.js';
import { ArrowRight } from 'lucide-react';

const Hero = () => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    const videoSrc = 'https://stream.mux.com/tLkHO1qZoaaQOUeVWo8hEBeGQfySP02EPS02BmnNFyXys.m3u8';

    if (!video) return;

    if (Hls.isSupported()) {
      // Initialize with enableWorker: false for stability in sandboxed environments
      const hls = new Hls({ enableWorker: false });
      hls.loadSource(videoSrc);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch((e) => console.log("Video play failed:", e));
      });

      return () => {
        if (hls) {
          hls.destroy();
        }
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Fallback for native HLS support (e.g., Safari)
      video.src = videoSrc;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch((e) => console.log("Video play failed:", e));
      });
    }
  }, []);

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-[#070b0a] pt-48 pb-40 flex flex-col items-center justify-center">
      {/* Video Background */}
      <div className="absolute inset-0 z-0">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover opacity-60"
        />
        {/* Gradients Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#070b0a] via-[#070b0a]/60 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b0a] via-transparent to-[#070b0a]/30"></div>
      </div>

      {/* Grid System (Visible on Desktop) */}
      <div className="hidden md:block absolute inset-0 z-0 pointer-events-none">
        <div className="absolute left-[25%] top-0 w-[1px] h-full bg-white/10"></div>
        <div className="absolute left-[50%] top-0 w-[1px] h-full bg-white/10"></div>
        <div className="absolute left-[75%] top-0 w-[1px] h-full bg-white/10"></div>
      </div>

      {/* Central SVG Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-0 pointer-events-none opacity-80">
        <svg width="800" height="400" viewBox="0 0 800 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse 
            cx="400" cy="200" rx="400" ry="200" 
            fill="url(#glow_gradient)" 
            style={{ filter: 'blur(25px)' }} 
          />
          <defs>
            <radialGradient id="glow_gradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(400 200) rotate(90) scale(200 400)">
              <stop stopColor="#00FFFF" stopOpacity="0.15" />
              <stop offset="1" stopColor="#006400" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-7xl mx-auto w-full">
        
        {/* Main Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl w-full font-bold font-sans text-white animate-fade-rise opacity-0 tracking-tight" style={{ lineHeight: '1.05' }}>
          Beyond silence,<br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
            we build the eternal.
          </span>
        </h1>

        <p className="text-base sm:text-lg max-w-3xl mt-8 leading-relaxed text-gray-300 animate-fade-rise-delay opacity-0">
          Building platforms for brilliant minds, fearless makers, and thoughtful souls. Through the noise, we craft digital havens for deep work and pure flows.
        </p>

        {/* CTA Button */}
        <Link 
          to="/contact" 
          className="mt-12 group relative inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-full transition-all duration-300 animate-fade-rise-delay-2 opacity-0 font-medium backdrop-blur-sm"
        >
          <span>Begin Journey</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </section>
  );
};

export default Hero;