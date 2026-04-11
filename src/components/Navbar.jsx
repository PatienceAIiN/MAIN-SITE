import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiMoon, FiSun } from 'react-icons/fi';
import ContentLink from './ContentLink';

const Navbar = ({ brand, navigation, onAction, theme = 'dark', onToggleTheme, currentPath }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef(null);
  const brandLetters = brand.name.split('');
  const isDark = theme === 'dark';

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
    <header ref={headerRef} className={`py-2.5 px-4 md:px-7 border-b relative z-50 transition-colors duration-500 ${isDark ? 'bg-[#1A1A1A] text-white border-white/5' : 'bg-white text-slate-900 border-slate-200/80'}`}>
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
            className={`site-brand flex items-center ${isDark ? 'site-brand--light' : 'site-brand--dark'}`}
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
                activeClassName={isDark ? 'bg-white/5 text-white' : 'bg-slate-900/5 text-slate-900'}
                inactiveClassName={isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-900/5'}
              />
            ))}
          </nav>

          <button
            type="button"
            onClick={onToggleTheme}
            className={`relative flex h-9 w-16 items-center rounded-full border px-1.5 transition-colors duration-500 ${isDark ? 'border-white/15 bg-white/10' : 'border-slate-300 bg-slate-100'}`}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
            title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          >
            <motion.span
              animate={{ x: isDark ? 0 : 26, rotate: isDark ? 0 : 360 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className={`flex h-6 w-6 items-center justify-center rounded-full ${isDark ? 'bg-slate-900 text-cyan-200' : 'bg-white text-amber-500'} shadow`}
            >
              {isDark ? <FiMoon size={14} /> : <FiSun size={14} />}
            </motion.span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className={`md:hidden ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            <span className="block w-6 h-0.5 bg-current shadow-[0_7px_0_currentColor,0_-7px_0_currentColor]" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className={`md:hidden mt-3 border-t pt-3 pb-2 flex flex-col gap-1 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          {navigation.map((item) => (
            <button
              key={`mobile-${item.label}`}
              type="button"
              onClick={() => handleNavClick(item.action)}
              className={`w-full text-left text-sm tracking-wide rounded-lg px-3 py-2 ${isDark ? 'text-gray-200 hover:text-white hover:bg-white/5' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-900/5'}`}
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
