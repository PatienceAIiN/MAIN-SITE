import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ContentLink from './ContentLink';

const Navbar = ({ brand, navigation, onAction, currentPath }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef(null);
  const brandLetters = brand.name.split('');

  const handleNavClick = (action) => {
    setMobileOpen(false);
    onAction(action);
  };

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const handleOutsidePointer = (event) => {
      if (!headerRef.current?.contains(event.target)) {
        setMobileOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointer);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  return (
    <header ref={headerRef} className="py-2.5 px-4 md:px-7 border-b relative z-50 transition-colors duration-500 bg-white text-slate-900 border-slate-200">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            onAction(brand.homeAction);
          }}
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
            className="site-brand site-brand--dark flex items-center"
          >
            {brandLetters.map((letter, index) => (
              <motion.span
                key={`${letter}-${index}`}
                variants={{
                  hidden: { opacity: 0, y: 6 },
                  show: {
                    opacity: 1,
                    y: 0,
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
                activeClassName="bg-slate-100 text-slate-900"
                inactiveClassName="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              />
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className="md:hidden text-slate-600 hover:text-slate-900"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            <span className="block w-6 h-0.5 bg-current shadow-[0_7px_0_currentColor,0_-7px_0_currentColor]" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="md:hidden mt-3 border-t pt-3 pb-2 flex flex-col gap-1 border-slate-200">
          {navigation.map((item) => (
            <button
              key={`mobile-${item.label}`}
              type="button"
              onClick={() => handleNavClick(item.action)}
              className="w-full text-left text-sm tracking-wide rounded-lg px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
};

export default Navbar;
