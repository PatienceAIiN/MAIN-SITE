import React from 'react';
import { motion } from 'framer-motion';
import Button from './ui/Button';

const Possibilities = ({ content, onAction }) => {
  const badgeGradients = [
    'from-cyan-400 via-sky-500 to-indigo-500',
    'from-amber-300 via-orange-400 to-pink-500',
    'from-emerald-400 via-cyan-400 to-blue-500',
    'from-violet-400 via-fuchsia-500 to-indigo-500'
  ];

  const getBadge = (title) =>
    title
      .split(' ')
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <section className="py-12 md:py-14 bg-white relative">
      <div className="container mx-auto px-6 max-w-[1400px]">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 relative items-start lg:items-center">
          <div className="lg:w-[40%] flex flex-col gap-5 lg:justify-center">
            <div className="space-y-5">
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-[13px] font-medium text-slate-500 tracking-[0.2em] uppercase block"
              >
                {content.eyebrow}
              </motion.span>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-[2.75rem] md:text-[3.25rem] lg:text-[3.75rem] font-semibold text-[#111111] leading-[1.02] tracking-tight"
              >
                {content.heading}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-slate-600 text-[16px] leading-[1.7] max-w-[90%]"
              >
                {content.description}
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="w-full flex justify-center mt-2"
            >
              <Button
                variant="purple"
                className="rounded-xl px-8 py-3.5 flex items-center gap-2 group"
                onClick={() => onAction(content.cta.action)}
              >
                {content.cta.label}
                <span className="w-5 h-5 inline-flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                  ↗
                </span>
              </Button>
            </motion.div>
          </div>

          <div className="lg:w-[60%] flex flex-col pt-1 lg:pt-0">
            {content.items.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
                className="flex items-start gap-5 sm:gap-8 group py-4"
              >
                <div className={`w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-full bg-gradient-to-br ${badgeGradients[index % badgeGradients.length]} shadow-[0_18px_50px_rgba(15,23,42,0.16)] grid place-items-center text-white font-semibold tracking-[0.2em]`}>
                  <span className="text-base sm:text-lg">{getBadge(item.title)}</span>
                </div>

                <div
                  className={`flex-1 pb-10 sm:pb-14 ${
                    index !== content.items.length - 1 ? 'border-b border-gray-300' : ''
                  } ${index !== 0 ? 'pt-1 sm:pt-2' : ''}`}
                >
                  <h3 className="text-[22px] font-semibold text-[#111111] mb-2">{item.title}</h3>
                  <p className="text-slate-600 text-[15px] leading-relaxed max-w-[95%]">{item.desc}</p>
                </div>
              </motion.div>
            ))}

          </div>
        </div>
      </div>
    </section>
  );
};

export default Possibilities;
