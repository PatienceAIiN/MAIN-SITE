import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiActivity, FiTarget, FiEdit2, FiCode, FiTrendingUp } = FiIcons;

const approaches = [
  {
    num: '/01',
    title: 'Understand',
    desc: 'We decode complex problems, analyze data, and define the intelligence behind every system.',
    icon: FiTarget
  },
  {
    num: '/02',
    title: 'Design',
    desc: 'We craft intuitive, immersive experiences that merge human behavior with intelligent interfaces.',
    icon: FiEdit2
  },
  {
    num: '/03',
    title: 'Engineer',
    desc: 'We develop scalable, high-performance systems powered by robust architecture and code.',
    icon: FiCode
  },
  {
    num: '/04',
    title: 'Evolve',
    desc: 'We continuously optimize and adapt systems through data, ensuring long-term growth and success.',
    icon: FiTrendingUp
  }
];

const OurApproach = () => {
  return (
    <section className="relative py-16 md:py-24 lg:py-32 bg-[#f4f4f4] overflow-hidden px-4 sm:px-6">
      {/* Subtle dotted background pattern */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      ></div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header Area */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 lg:gap-8 mb-12 md:mb-20 lg:mb-24">
          <div className="flex-1 w-full">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 border border-[#d1d1d1] bg-white shadow-sm rounded-full px-3 py-1.5 md:px-4 md:py-1.5 mb-6 md:mb-8">
              <SafeIcon icon={FiActivity} className="text-[#666666] text-xs md:text-sm" />
              <span className="text-xs md:text-sm font-medium tracking-wide text-[#666666]">Our Approach</span>
            </div>
            
            {/* Title - Fixed to match site-wide design system */}
            <h2 className="text-4xl sm:text-5xl md:text-[4rem] lg:text-[4.5rem] font-sans tracking-tighter leading-[1.05]">
              <span className="text-[#a3a3a3]">Building Intelligent </span>
              <span className="text-[#1a1a1a] font-medium block sm:inline lg:block xl:inline">Digital Systems</span>
            </h2>
          </div>
          
          {/* Subtitle */}
          <div className="w-full lg:w-[30%] pb-2">
            <p className="text-[#666666] text-base md:text-lg leading-relaxed max-w-md lg:max-w-none">
              From concept to execution we build systems that think, evolve, and perform seamlessly across all platforms.
            </p>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {approaches.map((item, index) => (
            <div 
              key={index} 
              className="flex flex-col h-full bg-white border border-[#e5e5e5] rounded-[20px] md:rounded-[24px] overflow-hidden relative group hover:border-[#d1d1d1] hover:shadow-lg transition-all duration-500 min-h-[320px] md:min-h-[400px]"
            >
              {/* Content Top */}
              <div className="p-6 md:p-8 pb-10 md:pb-12 flex-grow z-10">
                <span className="text-xs md:text-sm font-bold text-[#a3a3a3] mb-4 md:mb-6 block tracking-widest">{item.num}</span>
                <h3 className="text-xl md:text-2xl font-sans font-medium text-[#1a1a1a] mb-3 md:mb-4 tracking-tight">{item.title}</h3>
                <p className="text-[#666666] text-sm md:text-[15px] leading-relaxed">
                  {item.desc}
                </p>
              </div>

              {/* Visual Bottom */}
              <div className="relative h-32 md:h-40 w-full flex justify-center items-end mt-auto pointer-events-none">
                {/* The Dome */}
                <div 
                  className="absolute bottom-0 w-[140%] h-[75%] bg-[#f4f4f4] border-t border-[#e5e5e5] transition-transform duration-700 ease-out lg:group-hover:-translate-y-4"
                  style={{ borderRadius: '50% 50% 0 0' }}
                ></div>
                
                {/* The Icon Badge */}
                <div className="absolute top-2 md:top-4 left-1/2 -translate-x-1/2 bg-[#1a1a1a] w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-md z-20 transition-transform duration-700 ease-out lg:group-hover:-translate-y-4">
                  <SafeIcon icon={item.icon} className="text-white text-base md:text-lg" strokeWidth={2} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OurApproach;