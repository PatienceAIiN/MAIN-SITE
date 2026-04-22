import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const features = [
  "Every AI solution tied directly to business KPIs — not hype",
  "Built on real deployment experience across multiple industries and use cases",
  "Custom AI frameworks designed around your data, workflows, and scale",
  "Rapid deployment cycles — from idea to working solution in weeks, not months"
];

const ValueProposition = () => {
  // Smooth animation configurations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
    }
  };

  return (
    <section className="py-24 md:py-32 px-6 bg-[#f4f4f4]">
      <div className="max-w-7xl mx-auto">
        {/* Headline */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={itemVariants}
          className="mb-20 md:mb-32"
        >
          <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-sans tracking-tighter leading-[1.05]">
            <span className="text-[#c0c0c0]">Most AI projects fail</span><br />
            <span className="text-[#8c8c8c]">before they scale</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Left Column */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={itemVariants}
            className="flex flex-col"
          >
            <div className="mb-16">
              <p className="text-lg md:text-xl text-[#1a1a1a] leading-relaxed max-w-lg font-medium">
                If your AI initiatives aren’t delivering results, the problem isn’t the technology. It’s the strategy, implementation, and alignment with real business outcomes. Most companies experiment with AI based on trends. We build from real-world use cases, data readiness, and measurable impact so what you deploy actually works.
              </p>
            </div>

            <div className="mt-auto">
              <Link 
                to="/services" 
                className="bg-[#1a1a1a] text-white px-8 py-4 rounded-[4px] flex items-center gap-4 font-medium hover:bg-black transition-colors duration-300 w-fit"
              >
                <span className="relative flex h-2 w-2">
                  {/* Outer glowing dot */}
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></span>
                  {/* Inner solid dot with shadow */}
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.6)]"></span>
                </span>
                <span>See how it works</span>
              </Link>
            </div>
          </motion.div>

          {/* Right Column (List) */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="flex flex-col"
          >
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                className={`flex items-start gap-6 py-8 border-t border-[#d1d1d1] ${idx === features.length - 1 ? 'border-b' : ''}`}
              >
                <SafeIcon icon={FiArrowRight} className="text-[#1a1a1a] text-xl mt-1 flex-shrink-0 font-light" />
                <p className="text-lg md:text-xl text-[#1a1a1a] leading-snug">
                  {feature}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ValueProposition;