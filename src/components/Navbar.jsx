import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const Navbar = ({ brand }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Product', path: '/product' },
    { name: 'Services', path: '/services' },
    { name: 'Use Cases', path: '/use-cases' },
    { name: 'Contact Us', path: '/contact' }
  ];

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const isHome = location.pathname === '/';
  const brandTextColor = isHome ? 'text-white' : 'text-brand';
  const brandName = brand?.name || 'PatienceAI';

  return (
    <nav className={`absolute top-0 z-50 w-full transition-all duration-300 ${isMobileMenuOpen ? 'fixed inset-0 h-screen overflow-hidden bg-white' : 'bg-transparent'}`}>
      <div className="left-0 right-0 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link
          to="/"
          className={`relative z-50 text-3xl font-serif tracking-tight transition-opacity hover:opacity-80 ${isMobileMenuOpen ? 'text-brand' : brandTextColor}`}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          {brandName}
          <sup className="text-sm">®</sup>
        </Link>

        <div className="hidden items-center space-x-8 md:flex">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (location.pathname === '/' && item.name === 'Product');

            let linkColorClass = '';
            if (isHome) {
              linkColorClass = isActive ? 'text-white font-semibold' : 'text-white/70 hover:text-white';
            } else {
              linkColorClass = isActive ? 'text-brand font-semibold' : 'text-muted hover:text-brand';
            }

            return (
              <Link key={item.name} to={item.path} className={`text-sm font-medium transition-colors duration-300 ${linkColorClass}`}>
                {item.name}
              </Link>
            );
          })}
        </div>

        <Link
          to="/contact"
          className={`relative z-50 hidden rounded-[4px] px-6 py-2.5 text-center text-sm font-medium transition-colors duration-300 md:inline-block ${isHome ? 'bg-white text-black hover:bg-gray-200' : 'bg-[#1a1a1a] text-white hover:bg-black'}`}
        >
          Begin Journey
        </Link>

        <button
          className={`relative z-50 p-2 transition-opacity hover:opacity-70 md:hidden ${isMobileMenuOpen ? 'text-brand' : brandTextColor}`}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          <SafeIcon icon={isMobileMenuOpen ? FiX : FiMenu} size={28} strokeWidth={1.5} />
        </button>
      </div>

      <div className={`absolute left-0 top-[88px] flex h-[calc(100vh-88px)] w-full flex-col items-center gap-8 bg-white pt-16 transition-all duration-400 ease-in-out md:hidden ${isMobileMenuOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-8 opacity-0'}`}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (location.pathname === '/' && item.name === 'Product');
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`text-3xl font-sans font-medium tracking-tight transition-colors duration-300 ${isActive ? 'text-brand' : 'text-muted'}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {item.name}
            </Link>
          );
        })}
        <Link
          to="/contact"
          className="mt-12 rounded-[4px] bg-[#1a1a1a] px-12 py-4 text-center text-lg font-medium text-white shadow-md transition-colors duration-300 hover:bg-black"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          Begin Journey
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
