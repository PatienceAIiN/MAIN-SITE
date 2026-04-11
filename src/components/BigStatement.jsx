import React from 'react';
import { motion } from 'framer-motion';

const BigStatement = ({ content }) => {
  return (
    <section className="py-12 md:py-14 bg-white relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-blue-50 to-purple-50 rounded-full blur-[100px] -z-10" />
      <motion.div
        aria-hidden="true"
        animate={{ x: [0, 16, 0], y: [0, -12, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-20 top-16 h-56 w-56 rounded-full bg-sky-100/70 blur-3xl -z-10"
      />

      <div className="container mx-auto px-6 max-w-5xl text-center">
        <motion.h2
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-tight mb-5 md:mb-7"
        >
          {content.headingPrefix}{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600">
            {content.headingHighlight}
          </span>{' '}
          {content.headingSuffix}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="pt-6 md:pt-8 border-t border-slate-100"
        >
          <p className="text-sm md:text-base font-medium text-slate-700 tracking-wide mb-5">
            {content.trustedLine}
          </p>
          <div className="flex flex-wrap justify-center items-center gap-3 md:gap-4">
            {content.trustedHighlights.map((item) => (
              <span
                key={item}
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default BigStatement;
