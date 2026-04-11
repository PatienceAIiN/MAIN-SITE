import React from 'react';
import Hero from '../components/Hero';
import Features from '../components/Features';
import Possibilities from '../components/Possibilities';
import BigStatement from '../components/BigStatement';
import CTABanner from '../components/CTABanner';

const HomePage = ({ content, onAction }) => {
  return (
    <main>
      <Hero content={content.hero} onAction={onAction} />
      <div className="bg-white">
        <Features content={content.features} />
        <Possibilities content={content.possibilities} onAction={onAction} />
        <BigStatement content={content.statement} />
        <CTABanner content={content.ctaBanner} onAction={onAction} />
      </div>
    </main>
  );
};

export default HomePage;
