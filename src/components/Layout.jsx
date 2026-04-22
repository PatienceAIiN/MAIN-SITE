import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import ChatWidget from './ChatWidget';

const Layout = ({ children, siteContent, onBeginJourney }) => {
  const handleContactClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    const path = href.startsWith('http') ? new URL(href).pathname : href.split('#')[0].split('?')[0];
    if (path !== '/contact') return;

    event.preventDefault();
    onBeginJourney?.();
  };

  return (
    <div className="flex min-h-screen flex-col bg-white" onClickCapture={handleContactClick}>
      <Navbar brand={siteContent?.brand} />
      <main className="flex-grow">{children}</main>
      <Footer brand={siteContent?.brand} footerContent={siteContent?.footer} />
      <ChatWidget brand={siteContent?.brand} />
    </div>
  );
};

export default Layout;
