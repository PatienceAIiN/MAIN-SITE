import React, { useEffect, useState } from 'react';
import { FaInstagram, FaLinkedinIn, FaRedditAlien } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import ContentLink from './ContentLink';

const SOCIAL_ICONS = {
  X: FaXTwitter,
  Instagram: FaInstagram,
  Reddit: FaRedditAlien,
  LinkedIn: FaLinkedinIn
};

const Footer = ({ brand, content, onAction }) => {
  const [currentTime, setCurrentTime] = useState('');
  const [locationLabel, setLocationLabel] = useState('Pune, Maharashtra');

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

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await resp.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.county;
          const state = data.address?.state;
          if (city || state) {
            setLocationLabel([city, state].filter(Boolean).join(', '));
          }
        } catch {
          // keep default
        }
      },
      () => {
        // permission denied — keep default
      },
      { timeout: 8000 }
    );
  }, []);

  return (
    <footer className="border-t border-[#e5e5e5] bg-white text-[#1a1a1a]">
      <div className="relative border-b border-[#e5e5e5] px-6 py-4 text-[11px] font-medium uppercase tracking-[0.22em] text-[#666666] md:text-xs">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="font-serif text-lg normal-case tracking-tight text-[#1a1a1a]">
            {brand.name}
            <sup className="text-[0.6rem] align-super">®</sup>
          </div>
          <div className="hidden text-center md:block">Based in Pune, Maharashtra, India</div>
          <div className="flex gap-6">
            <span>{currentTime}</span>
            <span className="hidden sm:inline">{locationLabel}</span>
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

              return (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={link.label}
                  title={link.label}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d1d1d1] text-[#1a1a1a] transition-colors hover:border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white"
                >
                  {Icon ? <Icon size={18} /> : <span className="text-xs font-semibold">{link.label}</span>}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
