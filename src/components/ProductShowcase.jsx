import React from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiArrowRight } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const fallbackProducts = [
  {
    id: 'pariksha-ki-taiyari',
    name: 'PrepEdgeAI',
    summary: 'An intelligent platform delivering timed practice, instant feedback, and personalized recommendations for focused learning.',
    benefits: [
      'Modern JavaScript frontend with mobile-first delivery',
      'Scalable cloud backend for secure APIs and session handling',
      'Real-time sync layer for live collaboration'
    ],
    image: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=2070&auto=format&fit=crop'
  },
  {
    id: 'ai-email-saas',
    name: 'Customer AI Email Platform',
    summary: 'Enterprise AI email automation that produces context-aware drafts, enforces templates and policies, and provides actionable analytics.',
    benefits: [
      'Production AI model integration for generation and classification',
      'Asynchronous backend paired with a reactive frontend',
      'Ingestion to delivery pipeline with monitoring and retries'
    ],
    image: 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?q=80&w=2070&auto=format&fit=crop'
  }
];

const ProductShowcase = ({ products }) => {
  const items = Array.isArray(products) && products.length ? products : fallbackProducts;

  return (
    <section className="bg-white px-6 py-24 md:py-32">
      <div className="mx-auto flex max-w-7xl flex-col gap-24 md:gap-40">
        {items.map((product, index) => {
          const features = product.benefits || product.technologies || [];
          const reverse = index % 2 === 1;
          return (
            <div key={product.id} className={`flex flex-col items-center gap-12 lg:gap-20 ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
              <div className="w-full lg:w-1/2">
                <div className="group relative aspect-[4/3] overflow-hidden rounded-[24px] bg-[#f4f4f4] shadow-lg">
                  <img
                    src={product.image || `https://images.unsplash.com/photo-${index === 0 ? '1516321497487-e288fb19713f' : '1557200134-90327ee9fafa'}?q=80&w=2070&auto=format&fit=crop`}
                    alt={product.name}
                    className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105 group-hover:grayscale-0"
                  />
                  <div className="absolute inset-0 bg-black/10 transition-opacity duration-700 group-hover:opacity-0" />
                </div>
              </div>

              <div className="flex w-full flex-col lg:w-1/2">
                <h2 className="mb-6 text-4xl font-medium tracking-tight text-[#1a1a1a] md:text-5xl lg:text-6xl">{product.name}</h2>
                <p className="mb-6 text-xl font-medium leading-snug text-[#1a1a1a] md:text-2xl">{product.shortTagline || product.summary}</p>
                <p className="mb-8 text-lg leading-relaxed text-[#666666]">{product.summary}</p>

                <div className="mb-12">
                  <span className="mb-6 block text-[11px] font-bold uppercase tracking-[0.2em] text-[#a3a3a3]">Technical Capabilities</span>
                  <ul className="flex flex-col gap-4">
                    {features.slice(0, 4).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-4">
                        <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
                          <SafeIcon icon={FiCheck} className="text-xs text-white" strokeWidth={3} />
                        </div>
                        <span className="text-base text-[#333333] md:text-lg">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={`/product/${product.id}`}
                  className="inline-flex w-fit items-center gap-3 rounded-[4px] bg-[#1a1a1a] px-8 py-4 text-center font-medium text-white transition-colors duration-300 hover:bg-black"
                >
                  Read Case Study <SafeIcon icon={FiArrowRight} className="text-lg" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ProductShowcase;
