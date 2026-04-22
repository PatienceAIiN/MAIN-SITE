import React from 'react';
import ProductShowcase from '../components/ProductShowcase';
import FinalCTA from '../components/FinalCTA';

const Product = ({ siteContent }) => {
  const hero = siteContent?.productsPage?.hero;

  return (
    <div className="flex w-full flex-col">
      <div className="relative flex items-center justify-center overflow-hidden bg-[#f4f4f4] px-6 pb-24 pt-48 text-center">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />

        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="mb-8 inline-block rounded-full border border-[#d1d1d1] bg-white px-4 py-1.5 text-sm font-medium text-[#1a1a1a] shadow-sm animate-fade-rise">
            {hero?.eyebrow || 'Core Engines'}
          </div>
          <h1 className="mb-8 text-5xl font-serif leading-[1.05] tracking-tight text-[#1a1a1a] animate-fade-rise-delay md:text-7xl lg:text-[5.5rem]">
            {hero?.title || 'Our Products'}
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-[#666666] animate-fade-rise-delay-2 md:text-xl">
            {hero?.description || 'Discover the suite of tools designed to elevate your infrastructure. Built for performance, designed for elegance, and ready to scale.'}
          </p>
        </div>
      </div>

      <ProductShowcase products={siteContent?.productsPage?.products} />
      <FinalCTA />
    </div>
  );
};

export default Product;
