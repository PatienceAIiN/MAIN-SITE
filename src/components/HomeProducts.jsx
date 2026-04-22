import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const homeProducts = [
  {
    id: 'pariksha',
    title: 'PrepEdgeAI',
    caption: 'Fast, adaptive exam prep with intelligent practice, feedback, and collaboration.',
    image: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=600&auto=format&fit=crop'
  },
  {
    id: 'ai-email',
    title: 'Customer AI Email Platform',
    caption: 'Enterprise email automation with secure rules, context-aware drafting, and actionable analytics.',
    image: 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?q=80&w=600&auto=format&fit=crop'
  },
  {
    id: 'law-firm',
    title: 'Law Firm Case Management System',
    caption: 'Smart, centralized legal operations with seamless case tracking, automation, and client collaboration.',
    image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=600&auto=format&fit=crop'
  },
  {
    id: 'data-quality-flywheel',
    title: 'Data Quality Flywheel System',
    caption: 'Continuous data validation and AI refinement system designed to improve model accuracy, reliability, and decision quality over time.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=600&auto=format&fit=crop'
  },
  {
    id: 'ace-compere',
    title: 'Ace Compere – Employability AI',
    caption: 'AI-powered career acceleration platform designed to enhance employability through intelligent automation and personalized insights.',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=600&auto=format&fit=crop'
  }
];

const HomeProducts = () => {
  return (
    <section className="py-24 md:py-32 bg-white px-6 border-t border-[#e5e5e5]">
      <div className="max-w-7xl mx-auto">
        
        <div className="mb-16 md:mb-20">
          <div className="inline-block px-4 py-1.5 bg-[#f4f4f4] border border-[#d1d1d1] text-sm font-medium rounded-full mb-6 text-[#1a1a1a]">
            Our Products
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-[4rem] font-sans font-medium tracking-tighter text-[#1a1a1a] leading-[1.05]">
            Built for scale.<br className="hidden md:block" />
            <span className="text-[#a3a3a3]">Engineered for impact.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {homeProducts.map((product) => (
            <div 
              key={product.id}
              className="flex flex-col bg-[#f4f4f4] rounded-[24px] border border-[#e5e5e5] overflow-hidden group hover:shadow-xl hover:border-[#d1d1d1] transition-all duration-500"
            >
              {/* Card Image Header */}
              <div className="h-48 md:h-64 w-full relative overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.title} 
                  className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 ease-out"
                />
              </div>
              
              {/* Card Content Body */}
              <div className="p-8 md:p-10 flex flex-col flex-grow">
                <h3 className="text-3xl font-sans font-medium tracking-tight text-[#1a1a1a] mb-4">
                  {product.title}
                </h3>
                <p className="text-[#666666] text-lg leading-relaxed mb-10 flex-grow">
                  {product.caption}
                </p>
                <Link 
                  to={`/product/${product.id}`} 
                  className="bg-[#1a1a1a] text-white px-8 py-4 rounded-[4px] font-medium hover:bg-black transition-colors duration-300 w-fit flex items-center gap-3 text-center"
                >
                  Explore Platform <SafeIcon icon={FiArrowRight} className="text-lg" />
                </Link>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default HomeProducts;