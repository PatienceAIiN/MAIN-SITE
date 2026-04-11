import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Button from './ui/Button';
import SafeIcon from '../common/SafeIcon';
import { iconRegistry } from '../common/iconRegistry';

const Hero = ({ content, onAction }) => {
  const [launching, setLaunching] = useState(false);

  const handleExplore = () => {
    if (launching) {
      return;
    }

    setLaunching(true);
    window.setTimeout(() => {
      onAction(content.cta.action);
      window.setTimeout(() => setLaunching(false), 400);
    }, 700);
  };

  return (
    <section id="home" className="relative isolate w-full min-h-[580px] md:min-h-[650px] bg-[#050816] overflow-hidden">
      
      {/* Background Image Layer */}
      <div className="absolute inset-0 w-full h-full bg-black">
        <img 
          src={content.backgroundImage.src}
          alt={content.backgroundImage.alt}
          className="w-full h-full object-cover object-[72%_center] md:object-right" 
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-[#050816]/95 via-[#050816]/85 to-black/20 z-[1]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent z-[1]" />
      <motion.div
        aria-hidden="true"
        animate={{ x: [0, 14, 0], y: [0, -10, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[-5%] top-[12%] h-72 w-72 z-[1]"
      >
        <div className="h-full w-full rounded-full bg-indigo-500/20 blur-3xl" />
      </motion.div>
      <motion.div
        aria-hidden="true"
        animate={{ x: [0, -18, 0], y: [0, 12, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute right-[8%] bottom-[16%] h-80 w-80 z-[1]"
      >
        <div className="h-full w-full rounded-full bg-sky-400/10 blur-3xl" />
      </motion.div>

      <div className="relative z-20 flex min-h-[580px] md:min-h-[650px] flex-col justify-center px-6 py-6 md:px-10 md:py-8 lg:px-16 lg:py-9">
        <div className="mx-auto w-full max-w-[1440px]">
          <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.12 }}
              className="max-w-[52rem] self-start"
            >
              <h1 className="max-w-[14ch] text-white text-[clamp(2.25rem,3.3vw,4.4rem)] leading-[0.94] font-semibold tracking-[-0.055em]">
                {content.headline}
              </h1>
              <p className="mt-5 max-w-[52ch] text-slate-200 text-base md:text-lg leading-relaxed">
                {content.description}
              </p>
              <div className="mt-6">
                <Button
                  variant="coral"
                  className="relative overflow-hidden rounded-xl px-8 py-3.5 flex items-center gap-3"
                  onClick={handleExplore}
                >
                  <span className="relative z-10">Explore</span>
                  <SafeIcon icon={iconRegistry[content.cta.icon]} className="w-5 h-5" />
                  {launching && (
                    <motion.span
                      initial={{ opacity: 0, y: 10, scale: 0.6 }}
                      animate={{ opacity: [0, 1, 1, 0], y: [-6, -24, -58], x: [0, 8, 16], scale: [0.6, 1, 0.9] }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-2xl"
                    >
                      🚀
                    </motion.span>
                  )}
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 36, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-full lg:justify-self-end lg:max-w-[40rem] rounded-[2rem] rounded-tr-[2.6rem] border border-white/10 bg-[#050816]/90 px-6 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md md:px-8 md:py-8 lg:px-9 lg:py-9"
            >
              <div className="max-w-xl">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/55 mb-2">Governance</p>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      Auditable workflows, content updates, and request routing from one source.
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/55 mb-2">Delivery</p>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      Product, case studies, and contact flows tuned for speed and clarity.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

    </section>
  );
};

export default Hero;
