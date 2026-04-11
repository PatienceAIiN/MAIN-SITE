import React from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import { iconRegistry } from '../common/iconRegistry';
import BrandLogo from './BrandLogo';

// Reusable Corner Button Component with Inverted Radius CSS Magic
const CornerButton = ({ icon }) => (
  <div className="absolute bottom-0 right-0 bg-white pt-4 pl-4 rounded-tl-[2rem] z-20
    before:absolute before:bottom-full before:right-0 before:w-8 before:h-8 before:bg-transparent before:rounded-br-3xl before:shadow-[16px_16px_0_0_#ffffff]
    after:absolute after:bottom-0 after:right-full after:w-8 after:h-8 after:bg-transparent after:rounded-br-3xl after:shadow-[16px_16px_0_0_#ffffff]
  ">
    <button className="bg-[#1A1A1A] text-white w-14 h-14 rounded-full flex items-center justify-center hover:bg-black hover:scale-105 transition-all duration-300 shadow-lg">
      <SafeIcon icon={iconRegistry[icon]} className="w-6 h-6" />
    </button>
  </div>
);

const Features = ({ content }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } }
  };

  return (
    <section id="services" className="py-24 px-4 md:px-8 bg-white relative">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr"
      >
        
        {/* Card 1 (Left) */}
        <motion.div variants={itemVariants} className="col-span-1 bg-[#3A4366] rounded-[2rem] p-8 md:p-10 relative overflow-hidden flex flex-col min-h-[550px] group">
          {/* Background Image Placeholder (Robot/AI Head) */}
          <img 
            src={content.cards[0].image.src}
            alt={content.cards[0].image.alt}
            className="absolute top-0 -right-10 w-[70%] opacity-40 mix-blend-screen pointer-events-none group-hover:scale-105 transition-transform duration-700" 
          />
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex gap-3 mb-10">
              {content.cards[0].tags.map((tag) => (
                <span key={tag} className="px-5 py-1.5 rounded-full border border-white/30 text-white text-[13px] font-medium tracking-wide backdrop-blur-sm">
                  {tag}
                </span>
              ))}
            </div>
            
            <h2 className="text-white text-3xl md:text-[34px] font-medium leading-[1.2] mb-12 max-w-[90%]">
              {content.cards[0].title}
            </h2>
            
            <div className="mt-auto flex gap-4 pb-12">
              {content.cards[0].platforms.map((platform) => (
                <a
                  key={platform.label}
                  href={platform.href || '#'}
                  target={platform.href && platform.href !== '#' ? '_blank' : undefined}
                  rel={platform.href && platform.href !== '#' ? 'noreferrer noopener' : undefined}
                  aria-label={platform.label}
                  title={platform.label}
                  className={`w-12 h-12 rounded-full ${platform.backgroundClass} flex items-center justify-center shadow-lg hover:-translate-y-1 transition-transform cursor-pointer`}
                >
                  <SafeIcon icon={iconRegistry[platform.icon]} className="text-white w-6 h-6" />
                </a>
              ))}
            </div>
          </div>
          <CornerButton icon={content.cornerButtonIcon} />
        </motion.div>

        {/* Card 2 (Middle) */}
        <motion.div variants={itemVariants} className="col-span-1 bg-[#515C87] rounded-[2rem] p-8 md:p-10 relative overflow-hidden flex flex-col min-h-[550px] group">
          <div className="relative z-10 flex-1">
            <div className="mb-8">
              <SafeIcon icon={iconRegistry[content.cards[1].icon]} className="text-white w-8 h-8 opacity-80" />
            </div>
            <h2 className="text-white text-3xl md:text-[34px] font-medium leading-[1.2] mb-6">
              {content.cards[1].title}
            </h2>
            <p className="text-white/80 text-[15px] leading-relaxed max-w-[90%]">
              {content.cards[1].description}
            </p>
          </div>
          
          {/* Abstract Purple Image */}
          <img 
            src={content.cards[1].image.src}
            alt={content.cards[1].image.alt}
            className="absolute bottom-0 left-0 w-full h-[55%] object-cover object-top opacity-60 mix-blend-screen pointer-events-none rounded-b-[2rem] group-hover:scale-105 transition-transform duration-700" 
          />
          <CornerButton icon={content.cornerButtonIcon} />
        </motion.div>

        {/* Right Column (Cards 3 & 4) */}
        <motion.div variants={itemVariants} className="col-span-1 flex flex-col gap-6 min-h-[550px]">
          
          {/* Card 3 (Top Right) */}
          <div className="flex-[0.8] bg-[#A992DF] rounded-[2rem] p-8 flex items-center justify-center hover:scale-[1.02] transition-transform duration-300 cursor-pointer shadow-sm">
            <span className="text-white font-medium text-lg tracking-wide">
              {content.cards[2].title}
            </span>
          </div>
          
          {/* Card 4 (Bottom Right) */}
          <div className="flex-[1.2] bg-[#2A2B4A] rounded-[2rem] p-8 md:p-10 relative overflow-hidden flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300 group cursor-pointer shadow-md">
            {/* Abstract Wavy Background */}
            <img 
              src={content.cards[3].image.src}
              alt={content.cards[3].image.alt}
              className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-screen group-hover:opacity-70 transition-opacity duration-500" 
            />
            
            <div className="relative z-10">
              <h2 className="text-white text-3xl font-medium leading-[1.2] max-w-[95%]">
                {content.cards[3].title}
              </h2>
            </div>
            
            <div className="relative z-10 mt-8">
              <BrandLogo brand={{ name: content.cards[3].brand.label }} tone="light" compact />
            </div>
          </div>
          
        </motion.div>

      </motion.div>
    </section>
  );
};

export default Features;
