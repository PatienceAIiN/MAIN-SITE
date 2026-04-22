import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const FinalCTA = () => {
  return (
    <section className="py-24 md:py-32 bg-[#f4f4f4] px-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Content */}
        <div className="mb-16 md:mb-20">
          <h2 className="text-5xl md:text-[5.5rem] font-sans font-medium tracking-tighter text-[#1a1a1a] mb-6 leading-[1.05] max-w-4xl">
            Ready to transform how your enterprise uses AI?
          </h2>
          <p className="text-lg md:text-xl text-[#666666] max-w-2xl leading-relaxed">
            Join the forward-thinking teams already leveraging PatienceAI to redefine their digital landscapes.
          </p>
        </div>

        {/* Split CTA Buttons Block */}
        <div className="w-full flex flex-col md:flex-row border border-[#1a1a1a] rounded-[8px] overflow-hidden bg-white shadow-sm">
          
          <Link 
            to="/product" 
            className="flex-1 flex items-center justify-center gap-2 py-12 md:py-16 px-8 border-b md:border-b-0 md:border-r border-[#1a1a1a] group hover:bg-[#1a1a1a] transition-all duration-300"
          >
            <span className="text-2xl md:text-[28px] font-sans font-medium text-[#1a1a1a] group-hover:text-white transition-colors">
              Start free with email
            </span>
            <SafeIcon 
              icon={FiArrowRight} 
              className="text-2xl md:text-3xl text-[#1a1a1a] group-hover:text-white transition-all duration-300 transform group-hover:translate-x-1.5" 
            />
          </Link>
          
          <Link 
            to="/contact" 
            className="flex-1 flex items-center justify-center gap-2 py-12 md:py-16 px-8 group hover:bg-[#1a1a1a] transition-all duration-300"
          >
            <span className="text-2xl md:text-[28px] font-sans font-medium text-[#1a1a1a] group-hover:text-white transition-colors">
              Contact Sales
            </span>
            <SafeIcon 
              icon={FiArrowRight} 
              className="text-2xl md:text-3xl text-[#1a1a1a] group-hover:text-white transition-all duration-300 transform group-hover:translate-x-1.5" 
            />
          </Link>
          
        </div>

      </div>
    </section>
  );
};

export default FinalCTA;