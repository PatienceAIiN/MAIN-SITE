import React from 'react';
import { motion } from 'framer-motion';
import FadeIn from '../common/FadeIn';

const PageHero = ({ eyebrow, title, description, coverImage, children, align = 'center' }) => {
  const alignClass = align === 'left' ? 'text-left items-start' : 'text-center items-center';

  return (
    <section className="relative isolate overflow-hidden bg-[#0a0a0a] px-6 pb-20 pt-32 md:pt-40">
      {coverImage ? (
        <>
          <img
            src={coverImage}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-50"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/40 via-black/55 to-black/80"
          />
        </>
      ) : null}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />
      <FadeIn className={`relative mx-auto flex max-w-4xl flex-col ${alignClass}`}>
        {eyebrow ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mb-8 inline-block rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur"
          >
            {eyebrow}
          </motion.div>
        ) : null}
        {title ? (
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mb-8 font-serif text-5xl leading-[1.05] tracking-tight text-white md:text-7xl"
          >
            {title}
          </motion.h1>
        ) : null}
        {description ? (
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22 }}
            className="mx-auto max-w-2xl text-lg leading-relaxed text-white/85 md:text-xl"
          >
            {description}
          </motion.p>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </FadeIn>
    </section>
  );
};

export default PageHero;
