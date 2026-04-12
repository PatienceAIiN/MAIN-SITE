import React from 'react';
import { motion } from 'framer-motion';
import Button from './ui/Button';

const CTABanner = ({ content, onAction }) => {
  return (
    <section className="py-12 md:py-16 px-6">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative rounded-[2.25rem] overflow-hidden bg-white text-slate-900 py-12 md:py-14 px-8 md:px-16 text-center shadow-2xl border border-slate-200"
        >
          <div className="absolute inset-0 bg-noise opacity-5 mix-blend-overlay" />
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
            <motion.div
              animate={{ x: [0, 100, 0], y: [0, -50, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="absolute -top-[50%] -left-[10%] w-[70%] h-[150%]"
            >
              <div className="h-full w-full rounded-full bg-gradient-to-br from-blue-200/60 to-transparent blur-3xl" />
            </motion.div>
            <motion.div
              animate={{ x: [0, -100, 0], y: [0, 50, 0] }}
              transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
              className="absolute -bottom-[50%] -right-[10%] w-[70%] h-[150%]"
            >
              <div className="h-full w-full rounded-full bg-gradient-to-tl from-purple-200/60 to-transparent blur-3xl" />
            </motion.div>
          </div>

          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-tight">{content.heading}</h2>
            <p className="text-lg text-slate-600 mb-7 max-w-xl mx-auto">{content.description}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-2xl mx-auto">
              {content.buttons.map((button) => (
                <Button
                  key={button.label}
                  variant={button.variant}
                  className="w-full sm:flex-1 text-lg px-8 py-4 rounded-2xl"
                  onClick={() => onAction(button.action)}
                >
                  {button.label}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTABanner;
