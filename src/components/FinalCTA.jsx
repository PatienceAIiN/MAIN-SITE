import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiArrowRight, FiX } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import NewsletterForm from './NewsletterForm';

const FinalCTA = () => {
  const [showNewsletter, setShowNewsletter] = useState(false);

  return (
    <section className="py-24 md:py-32 bg-[#f4f4f4] px-6">
      <div className="max-w-7xl mx-auto">

        {/* Header Content */}
        <div className="mb-16 md:mb-20">
          <h2 className="text-5xl md:text-[5.5rem] font-sans font-medium tracking-tighter text-[#1a1a1a] mb-6 leading-[1.05] max-w-4xl">
            Ready to transform how your enterprise uses AI?
          </h2>
          <p className="text-lg md:text-xl text-[#666666] max-w-2xl leading-relaxed">
            Join the forward-thinking teams already leveraging PatienceAI to redefine their digital landscapes.
          </p>
        </div>

        {/* Split CTA Buttons Block */}
        <div className="w-full flex flex-col md:flex-row border border-[#1a1a1a] rounded-[8px] overflow-hidden bg-white shadow-sm">

          <button
            type="button"
            onClick={() => setShowNewsletter(true)}
            className="flex-1 flex items-center justify-center gap-2 py-12 md:py-16 px-8 border-b md:border-b-0 md:border-r border-[#1a1a1a] group hover:bg-[#1a1a1a] transition-all duration-300"
          >
            <span className="text-2xl md:text-[28px] font-sans font-medium text-[#1a1a1a] group-hover:text-white transition-colors">
              Subscribe to our newsletter
            </span>
            <SafeIcon
              icon={FiArrowRight}
              className="text-2xl md:text-3xl text-[#1a1a1a] group-hover:text-white transition-all duration-300 transform group-hover:translate-x-1.5"
            />
          </button>

          <Link
            to="/company/contact"
            className="flex-1 flex items-center justify-center gap-2 py-12 md:py-16 px-8 group hover:bg-[#1a1a1a] transition-all duration-300"
          >
            <span className="text-2xl md:text-[28px] font-sans font-medium text-[#1a1a1a] group-hover:text-white transition-colors">
              Contact Sales
            </span>
            <SafeIcon
              icon={FiArrowRight}
              className="text-2xl md:text-3xl text-[#1a1a1a] group-hover:text-white transition-all duration-300 transform group-hover:translate-x-1.5"
            />
          </Link>

        </div>

      </div>

      {/* Newsletter Dialog */}
      <AnimatePresence>
        {showNewsletter ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
            onClick={() => setShowNewsletter(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.25 }}
              className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-10"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Newsletter subscription"
            >
              <button
                type="button"
                onClick={() => setShowNewsletter(false)}
                className="absolute right-4 top-4 rounded-full p-2 text-[#666666] transition-colors hover:bg-[#f0f0f0] hover:text-[#1a1a1a]"
                aria-label="Close newsletter dialog"
              >
                <SafeIcon icon={FiX} className="text-xl" />
              </button>
              <h3 className="mb-2 text-2xl font-medium tracking-tight text-[#1a1a1a]">Subscribe to our newsletter</h3>
              <p className="mb-6 text-[#666666]">Product updates, podcast drops, and engineering notes. No spam.</p>
              <NewsletterForm tone="light" />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};

export default FinalCTA;
