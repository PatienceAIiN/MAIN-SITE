import React, { useEffect, useState } from 'react';
import ContentLink from './ContentLink';

const Navbar = ({ brand, navigation, onAction, currentPath }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[160] border-b border-slate-200/80 transition-all duration-300 ${
        mobileOpen ? 'bg-white shadow-sm' : 'bg-white/95 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            onAction(brand.homeAction);
          }}
          className="font-serif text-[1.55rem] tracking-tight text-[#1a1a1a] transition-opacity hover:opacity-80 sm:text-[1.85rem]"
          aria-label={brand.name}
        >
          {brand.name}
          <sup className="text-[0.65rem] align-super">®</sup>
        </button>

        <nav className="hidden items-center gap-8 md:flex">
          {navigation.map((item) => (
            <ContentLink
              key={item.label}
              item={item}
              onAction={onAction}
              className="text-sm font-medium transition-colors duration-300"
              activeClassName="text-[#1a1a1a]"
              inactiveClassName="text-[#666666] hover:text-[#1a1a1a]"
            />
          ))}
        </nav>

        <div className="hidden md:block">
          <button
            type="button"
            onClick={() => onAction({ type: 'modal', target: 'sales' })}
            className="rounded-full bg-[#1a1a1a] px-6 py-2.5 text-sm font-medium text-white transition-transform duration-300 hover:scale-[1.03]"
          >
            Begin Journey
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="relative z-10 flex h-10 w-10 items-center justify-center md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          <span className="relative block h-4 w-6">
            <span
              className={`absolute left-0 top-0 h-0.5 w-6 bg-[#1a1a1a] transition-all duration-300 ${
                mobileOpen ? 'top-[7px] rotate-45' : ''
              }`}
            />
            <span
              className={`absolute left-0 top-[7px] h-0.5 w-6 bg-[#1a1a1a] transition-all duration-300 ${
                mobileOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`absolute left-0 top-[14px] h-0.5 w-6 bg-[#1a1a1a] transition-all duration-300 ${
                mobileOpen ? 'top-[7px] -rotate-45' : ''
              }`}
            />
          </span>
        </button>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 md:hidden ${
          mobileOpen ? 'max-h-[80vh] border-t border-[#e5e5e5]' : 'max-h-0'
        }`}
      >
        <nav className="flex flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10">
          {navigation.map((item) => (
            <ContentLink
              key={`mobile-${item.label}`}
              item={item}
              onAction={onAction}
              className="text-2xl sm:text-3xl font-medium tracking-tight transition-colors duration-300"
              activeClassName="text-[#1a1a1a]"
              inactiveClassName="text-[#666666] hover:text-[#1a1a1a]"
            />
          ))}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onAction({ type: 'modal', target: 'sales' });
            }}
            className="mt-6 w-fit rounded-full bg-[#1a1a1a] px-10 py-4 text-lg font-medium text-white"
          >
            Begin Journey
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
