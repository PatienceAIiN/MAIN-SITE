import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const features = [
  {
    id: 1,
    title: "PrepEdgeAI",
    description: "Fast, adaptive exam prep with intelligent practice and collaboration. We re-architected the system using microservices to handle massive traffic surges, ensuring zero downtime for 100k+ students.",
    image: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=2070&auto=format&fit=crop"
  },
  {
    id: 2,
    title: "Customer AI Email Platform",
    description: "Enterprise email automation with secure rules, context-aware drafting, and analytics. Custom AI models classify queries instantly, reducing response times by 70% and freeing operations teams.",
    image: "https://images.unsplash.com/photo-1557200134-90327ee9fafa?q=80&w=2070&auto=format&fit=crop"
  },
  {
    id: 3,
    title: "Law Firm Case Management System",
    description: "Smart, centralized legal operations with seamless case tracking, automation, and client collaboration. A comprehensive platform enabling law firms to manage cases, documents, payments, and communication efficiently.",
    image: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=2070&auto=format&fit=crop"
  },
  {
    id: 4,
    title: "Data Quality Flywheel System",
    description: "Continuous data validation and AI refinement system designed to improve model accuracy, reliability, and decision quality over time. An intelligent pipeline that combines data extraction, validation, and feedback loops.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
  },
  {
    id: 5,
    title: "Ace Compere – Employability AI",
    description: "AI-powered career acceleration platform designed to enhance employability through intelligent automation, personalized insights, and end-to-end job application workflows.",
    image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop"
  }
];

// Product Section (Internal Naming Concept)
const FeatureScroll = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRefs = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.dataset.index);
            setActiveIndex(index);
          }
        });
      },
      { root: null, rootMargin: "-40% 0px -40% 0px", threshold: 0 }
    );

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      sectionRefs.current.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, []);

  return (
    <section className="py-24 md:py-32 bg-[#f2f2f2] relative">
      {/* Top Header Section */}
      <div className="max-w-7xl mx-auto px-6 mb-24 md:mb-40">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 items-start">
          <div className="lg:w-3/5">
            <h2 className="text-5xl sm:text-6xl md:text-[5.5rem] leading-[0.95] tracking-tighter text-[#a3a3a3] font-sans">
              We spent 2 year building<br className="hidden md:block"/> an internal system
            </h2>
          </div>
          <div className="lg:w-2/5">
            <div className="bg-[#e6e6e6] p-8 md:p-10 rounded-xl shadow-sm">
              <p className="text-xl md:text-2xl text-[#1a1a1a] leading-snug tracking-tight mb-8">
                "Excellent exprience, hitting 15-20x ROAS on our ads. The detail in the market research and then quality of ads is worth it."
              </p>
              <div>
                <p className="text-[#1a1a1a] font-medium text-lg">Edward Clayton</p>
                <p className="text-[#666666]">Director, Maid To Clean</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Scroll Section */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-start relative">
          
          {/* Left Side: Sticky Media (Desktop Only) */}
          <div className="hidden lg:block lg:w-[55%] sticky top-32 h-[70vh] rounded-2xl overflow-hidden shadow-2xl">
            {features.map((feature, idx) => (
              <div 
                key={feature.id}
                className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                  activeIndex === idx ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.02]'
                }`}
              >
                <img 
                  src={feature.image} 
                  alt={feature.title}
                  className="w-full h-full object-cover filter brightness-[0.8]"
                />
                <div className="absolute inset-0 bg-black/10 mix-blend-multiply"></div>
              </div>
            ))}
          </div>

          {/* Right Side: Scrolling Content */}
          <div className="w-full lg:w-[45%] lg:pl-20">
            {features.map((feature, idx) => (
              <div 
                key={feature.id}
                ref={(el) => (sectionRefs.current[idx] = el)}
                data-index={idx}
                className="min-h-[60vh] lg:min-h-[85vh] flex flex-col justify-center py-12 lg:py-0"
              >
                <div className="block lg:hidden w-full h-[60vw] rounded-2xl overflow-hidden mb-8 shadow-lg">
                  <img 
                    src={feature.image} 
                    alt={feature.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: false, margin: "-20%" }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  <h3 className="text-4xl sm:text-5xl md:text-6xl font-sans tracking-tighter text-[#1a1a1a] mb-8 leading-none">
                    {feature.title}
                  </h3>
                  <p className="text-lg md:text-xl text-[#333333] leading-relaxed mb-10 max-w-lg line-clamp-3">
                    {feature.description}
                  </p>
                  <Link 
                    to="/product" 
                    className="bg-[#1a1a1a] text-white px-8 py-4 rounded-[4px] font-medium hover:bg-black transition-colors duration-300 w-fit inline-block text-center"
                  >
                    View Product
                  </Link>
                </motion.div>
              </div>
            ))}
            <div className="hidden lg:block h-[20vh]"></div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default FeatureScroll;