import React from 'react';
import { motion } from 'framer-motion';
import ContentLink from './ContentLink';

const Navbar = ({ brand, navigation, onAction }) => {
  const brandLetters = brand.name.split('');

  return (
    <header className="bg-[#1A1A1A] text-white py-2.5 px-4 md:px-7 flex items-center justify-between border-b border-white/5 relative z-50">
      <button
        type="button"
        onClick={() => onAction(brand.homeAction)}
        className="flex items-center shrink-0"
        aria-label={brand.name}
      >
        <motion.span
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: {
                staggerChildren: 0.035,
                delayChildren: 0.05
              }
            }
          }}
          className="site-brand site-brand--light flex items-center"
        >
          {brandLetters.map((letter, index) => (
            <motion.span
              key={`${letter}-${index}`}
              variants={{
                hidden: { opacity: 0, y: 6, filter: 'blur(4px)' },
                show: {
                  opacity: 1,
                  y: 0,
                  filter: 'blur(0px)',
                  transition: {
                    type: 'spring',
                    stiffness: 260,
                    damping: 18
                  }
                }
              }}
              className="inline-block"
            >
              {letter === ' ' ? '\u00A0' : letter}
            </motion.span>
          ))}
        </motion.span>
      </button>

      <div className="flex items-center gap-4 md:gap-6">
        <nav className="hidden md:flex items-center gap-2">
          {navigation.map((item) => (
            <ContentLink
              key={item.label}
              item={item}
              onAction={onAction}
              className="text-[13px] font-medium tracking-wider px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2"
              activeClassName="bg-white/5 text-white"
              inactiveClassName="text-gray-400 hover:text-white hover:bg-white/5"
            />
          ))}
        </nav>

        <button className="md:hidden text-gray-400 hover:text-white">
        <span className="block w-6 h-0.5 bg-current shadow-[0_7px_0_currentColor,0_-7px_0_currentColor]" />
        </button>
      </div>
    </header>
  );
};

export default Navbar;
