import React, { useEffect, useState } from 'react';
import { FaInstagram, FaLinkedinIn, FaRedditAlien, FaYoutube } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import ContentLink from './ContentLink';

const SOCIAL_ICONS = {
  X: FaXTwitter,
  Instagram: FaInstagram,
  Reddit: FaRedditAlien,
  LinkedIn: FaLinkedinIn,
  YouTube: FaYoutube
};

const LOCATION_LABEL = 'Remote-first · Distributed across India';

const Footer = ({ brand, content, onAction }) => {
  const [currentTime, setCurrentTime] = useState('');
  const [linkedinNotice, setLinkedinNotice] = useState(false);

  useEffect(() => {
    if (!linkedinNotice) return undefined;
    const t = window.setTimeout(() => setLinkedinNotice(false), 2600);
    return () => window.clearTimeout(t);
  }, [linkedinNotice]);

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
    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <footer className="border-t border-[#e5e5e5] bg-white text-[#1a1a1a]">
      <div className="relative border-b border-[#e5e5e5] px-6 py-4 text-[11px] font-medium uppercase tracking-[0.22em] text-[#666666] md:text-xs">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="font-serif text-lg normal-case tracking-tight text-[#1a1a1a]">
            {brand.name}
            <sup className="text-[0.6rem] align-super">®</sup>
          </div>
          <div className="text-center">{LOCATION_LABEL}</div>
          <div className="flex gap-6">
            <span>{currentTime}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 pb-6 pt-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8 lg:pb-10 lg:pt-10">
        <div>
          <h2 className="text-3xl font-medium uppercase tracking-[-0.04em] sm:text-4xl md:text-5xl lg:text-[4rem] lg:leading-[1.02]">
            Building AI services
            <br />
            for brilliant minds
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#666666]">{content.description}</p>
        </div>

        <div className="grid grid-cols-1 gap-12 sm:grid-cols-3">
          {content.columns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.24em] text-[#a3a3a3]">
                {column.title}
              </h3>
              <ul className="space-y-4">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <ContentLink
                      item={link}
                      onAction={onAction}
                      className="text-sm font-medium uppercase tracking-[0.12em] text-[#1a1a1a] transition-colors hover:text-[#666666]"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#e5e5e5] px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-[#8c8c8c] md:flex-row md:items-center md:justify-between">
          <p>{content.copyright.replace(/Â©|Ã‚Â©/g, '©')}</p>
          <div id="footer-social-links" className="flex flex-wrap gap-6">
            {content.socialLinks.map((link) => {
              const Icon = SOCIAL_ICONS[link.label];
              const commonClass = "inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d1d1d1] text-[#1a1a1a] transition-colors hover:border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white";
              const inner = Icon ? <Icon size={18} /> : <span className="text-xs font-semibold">{link.label}</span>;

              if (link.label === 'LinkedIn') {
                return (
                  <button
                    key={link.label}
                    type="button"
                    onClick={() => setLinkedinNotice(true)}
                    aria-label={link.label}
                    title={link.label}
                    className={commonClass}
                  >
                    {inner}
                  </button>
                );
              }

              return (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={link.label}
                  title={link.label}
                  className={commonClass}
                >
                  {inner}
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {linkedinNotice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="LinkedIn notice"
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 px-4"
          onClick={() => setLinkedinNotice(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#e5e5e5] bg-white p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl text-[#1a1a1a]">LinkedIn</h3>
            <p className="mt-3 text-sm text-[#444]">We will update soon.</p>
            <button
              type="button"
              onClick={() => setLinkedinNotice(false)}
              className="mt-5 rounded-full bg-[#1a1a1a] px-5 py-2 text-xs font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;
