import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowUpRight } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { fetchJson } from '../common/fetchJson';

const Footer = ({ brand, footerContent }) => {
  const [currentTime, setCurrentTime] = useState('');
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          weekday: 'long',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleNewsletterSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage('');

    try {
      const response = await fetchJson('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Newsletter subscriber',
          email,
          subject: 'Newsletter signup',
          message: `Please add ${email} to the PatienceAI newsletter or updates list.`,
          source: 'newsletter'
        })
      });
      setStatusMessage(response?.message || 'Request received successfully.');
      setEmail('');
    } catch (error) {
      setStatusMessage(error.message || 'Unable to submit right now.');
    }
  };

  const brandName = brand?.name || 'PatienceAI';
  const footerDescription =
    footerContent?.description ||
    'Join our newsletter to stay informed about new features, platform updates, use cases, product launches, and more.';

  return (
    <footer className="relative z-10 flex w-full flex-col border-t border-[#e5e5e5] bg-white text-[#1a1a1a]">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-[#e5e5e5] px-6 py-4 text-[11px] font-medium uppercase tracking-widest text-[#666666] md:flex-row md:items-center md:gap-0 md:text-xs">
        <div className="flex-shrink-0 font-serif text-lg normal-case tracking-tight text-[#1a1a1a]">
          {brandName}
          <sup className="text-[10px]">®</sup>
        </div>
        <div className="pointer-events-none absolute left-1/2 hidden w-full max-w-md -translate-x-1/2 text-center md:block">
          BASED IN PUNE, MAHARASHTRA, INDIA
        </div>
        <div className="flex flex-shrink-0 gap-4 md:gap-8">
          <span>{currentTime || 'Sunday 1:25 AM'}</span>
          <span className="hidden sm:inline-block">18.5204° N | 73.8567° E</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-16 px-6 pb-16 pt-20 lg:grid-cols-12 lg:gap-8 md:pb-24 md:pt-32">
        <div className="flex flex-col lg:col-span-8">
          <h2 className="mb-4 max-w-5xl text-3xl font-medium uppercase leading-[1.05] tracking-tighter sm:text-4xl md:mb-6 md:text-5xl lg:text-[4rem]">
            Building platforms
            <br />
            for brilliant minds
          </h2>
          <a
            href="mailto:growth@patienceai.in"
            className="text-2xl tracking-tight text-[#1a1a1a] transition-colors hover:text-[#666666] sm:text-3xl md:text-4xl lg:text-[3rem]"
          >
            growth@patienceai.in
          </a>
        </div>

        <div className="flex flex-col justify-start lg:col-span-4 lg:pt-4">
          <form onSubmit={handleNewsletterSubmit} className="group relative mb-6 flex w-full items-center border-b border-[#d1d1d1] pb-3">
            <input
              type="email"
              placeholder="Your Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-transparent text-lg font-medium text-[#1a1a1a] outline-none placeholder-[#a3a3a3]"
              required
            />
            <button type="submit" className="p-1 text-[#1a1a1a] transition-colors group-hover:text-[#666666]" aria-label="Subscribe">
              <SafeIcon icon={FiArrowUpRight} strokeWidth={1.5} size={24} />
            </button>
          </form>
          <p className="max-w-sm text-[15px] leading-relaxed text-[#666666]">{footerDescription}</p>
          {statusMessage ? <p className="mt-3 text-sm text-[#666666]">{statusMessage}</p> : null}
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-10 px-6 pb-12 text-sm font-medium uppercase tracking-widest text-[#1a1a1a] md:flex-row md:items-center md:gap-0">
        <ul className="flex flex-col flex-wrap gap-6 sm:flex-row sm:gap-10">
          <li><Link to="/product" className="transition-colors hover:text-[#666666]">Product</Link></li>
          <li><Link to="/services" className="transition-colors hover:text-[#666666]">Services</Link></li>
          <li><Link to="/use-cases" className="transition-colors hover:text-[#666666]">Use Cases</Link></li>
          <li><Link to="/contact" className="transition-colors hover:text-[#666666]">Contact</Link></li>
        </ul>
      </div>

      <div className="pointer-events-none select-none overflow-hidden bg-white px-6 pb-6 pt-10 md:pb-8">
        <h1 className="flex w-full items-center justify-between text-[14.4vw] font-bold uppercase leading-none text-[#1a1a1a] sm:text-[14.9vw] md:text-[15.4vw] lg:text-[15.9vw]">
          {'PATIENCEAI'.split('').map((letter, index) => (
            <span key={index}>{letter}</span>
          ))}
        </h1>
      </div>

      <div className="relative z-20 flex flex-col items-center justify-between border-t border-[#e5e5e5] bg-white px-6 py-6 text-xs text-[#8c8c8c] md:flex-row">
        <p>{footerContent?.copyright || '© 2026 PatienceAI. All rights reserved.'}</p>
        <div className="mt-4 flex gap-8 font-medium tracking-wide md:mt-0">
          <Link to="/privacy" className="transition-colors hover:text-[#1a1a1a]">Privacy Policy</Link>
          <Link to="/terms" className="transition-colors hover:text-[#1a1a1a]">Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
