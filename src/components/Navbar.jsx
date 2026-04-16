import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ContentLink from './ContentLink';

const Navbar = ({ brand, navigation, onAction, currentPath }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef(null);

  // Close on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  // Close on outside click (mobile auto-collapse)
  useEffect(() => {
    if (!mobileOpen) return;
    const handleOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [mobileOpen]);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (mobileOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  // Scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const menuVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: {
      opacity: 1,
      height: 'auto',
      transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] }
    },
    exit: {
      opacity: 0,
      height: 0,
      transition: { duration: 0.22, ease: [0.4, 0, 1, 1] }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -14 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.055, duration: 0.28, ease: 'easeOut' }
    })
  };

  return (
    <header
      ref={navRef}
      className={`fixed inset-x-0 top-0 z-[160] w-full transition-all duration-300 ${
        scrolled || mobileOpen
          ? 'bg-white shadow-[0_1px_24px_rgba(0,0,0,0.08)] border-b border-slate-200/60'
          : 'bg-white/90 backdrop-blur-xl border-b border-slate-200/40'
      }`}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-3.5 sm:px-6 sm:py-4">

        {/* Brand */}
        <motion.button
          type="button"
          onClick={() => { setMobileOpen(false); onAction(brand.homeAction); }}
          className="font-serif text-[1.75rem] tracking-tight text-[#1a1a1a] sm:text-[1.85rem]"
          aria-label={brand.name}
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
          whileHover={{ opacity: 0.75 }}
          whileTap={{ scale: 0.97 }}
        >
          {brand.name}
          <sup className="text-[0.6rem] align-super">®</sup>
        </motion.button>

        {/* Desktop nav */}
        <motion.nav
          className="hidden items-center gap-7 md:flex"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {navigation.map((item) => (
            <motion.div
              key={item.label}
              whileHover={{ y: -1 }}
              transition={{ duration: 0.15 }}
            >
              <ContentLink
                item={item}
                onAction={onAction}
                className="text-sm font-medium transition-colors duration-200 relative group"
                activeClassName="text-[#1a1a1a]"
                inactiveClassName="text-[#666666] hover:text-[#1a1a1a]"
              />
            </motion.div>
          ))}
        </motion.nav>

        {/* Desktop CTA */}
        <div className="hidden md:block">
          <motion.button
            type="button"
            onClick={() => onAction({ type: 'modal', target: 'sales' })}
            className="rounded-full bg-[#1a1a1a] px-6 py-2.5 text-sm font-medium text-white"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            whileHover={{ scale: 1.04, backgroundColor: '#333333' }}
            whileTap={{ scale: 0.97 }}
          >
            Begin Journey
          </motion.button>
        </div>

        {/* Hamburger */}
        <motion.button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="relative z-10 flex h-10 w-10 items-center justify-center md:hidden rounded-lg"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
          whileTap={{ scale: 0.9 }}
          transition={{ duration: 0.12 }}
        >
          <span className="relative block h-[14px] w-6">
            <motion.span
              className="absolute left-0 h-0.5 w-6 rounded-full bg-[#1a1a1a] origin-center"
              animate={mobileOpen ? { top: '7px', rotate: 45 } : { top: '0px', rotate: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            />
            <motion.span
              className="absolute left-0 top-[7px] h-0.5 w-6 rounded-full bg-[#1a1a1a]"
              animate={mobileOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.18 }}
            />
            <motion.span
              className="absolute left-0 h-0.5 w-6 rounded-full bg-[#1a1a1a] origin-center"
              animate={mobileOpen ? { top: '7px', rotate: -45 } : { top: '14px', rotate: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            />
          </span>
        </motion.button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-menu"
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="overflow-hidden border-t border-[#e5e5e5] bg-white md:hidden"
          >
            <nav className="flex flex-col px-5 pb-8 pt-6 sm:px-6">
              {navigation.map((item, i) => (
                <motion.div
                  key={`mobile-${item.label}`}
                  custom={i}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="border-b border-slate-100 last:border-none"
                >
                  <ContentLink
                    item={item}
                    onAction={(action) => { setMobileOpen(false); onAction(action); }}
                    className="block w-full py-4 text-xl font-medium tracking-tight transition-colors duration-200"
                    activeClassName="text-[#1a1a1a]"
                    inactiveClassName="text-[#555555] hover:text-[#1a1a1a]"
                  />
                </motion.div>
              ))}
              <motion.button
                type="button"
                onClick={() => { setMobileOpen(false); onAction({ type: 'modal', target: 'sales' }); }}
                className="mt-6 w-fit rounded-full bg-[#1a1a1a] px-9 py-3.5 text-base font-medium text-white"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: navigation.length * 0.055 + 0.05, duration: 0.25 }}
                whileTap={{ scale: 0.97 }}
              >
                Begin Journey
              </motion.button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
