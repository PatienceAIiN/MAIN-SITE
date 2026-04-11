import React from 'react';
import { motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import Button from './ui/Button';

const possibilitiesData = [
  {
    // Using abstract 3D render images with mix-blend-multiply to simulate the wireframe graphics
    img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop",
    title: "Cutting-edge technology",
    desc: "Integrating neural network models into existing systems or software applications, enabling businesses to leverage AI capabilities seamlessly."
  },
  {
    img: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=400&auto=format&fit=crop",
    title: "Tailored solutions",
    desc: "Integrating neural network models into existing systems or software applications, enabling businesses to leverage AI capabilities seamlessly."
  },
  {
    // Verified working image: Abstract 3D purple/blue gradient waves that matches the family
    img: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop",
    title: "Training and workshops",
    desc: "Custom design and development of neural network architectures tailored to specific business needs and objectives."
  },
  {
    img: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=400&auto=format&fit=crop",
    title: "Modern development",
    desc: "Building and training deep neural networks for tasks such as image recognition, natural language processing, speech recognition, and anomaly detection."
  }
];

const Possibilities = () => {
  return (
    <section className="py-24 lg:py-32 bg-white relative">
      <div className="container mx-auto px-6 max-w-[1400px]">
        
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 relative items-start">
          
          {/* Left Column (Sticky Content) */}
          <div className="lg:w-[45%] lg:sticky lg:top-32 flex flex-col h-full min-h-[60vh] justify-between">
            <div>
              <motion.span 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-[13px] font-medium text-slate-500 tracking-[0.2em] uppercase mb-8 block"
              >
                [ possibilities ]
              </motion.span>
              
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-[2.75rem] md:text-[3.5rem] lg:text-[4rem] font-medium text-[#111111] leading-[1.05] tracking-tight mb-8"
              >
                Explore limitless <br className="hidden md:block" />
                possibilities with our <br className="hidden md:block" />
                intelligent solutions
              </motion.h2>

              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-slate-600 text-[16px] leading-[1.7] mb-10 max-w-[90%]"
              >
                AIERO is a leading AI agency committed to transforming businesses through cutting-edge artificial intelligence solutions. We specialize in delivering tailored AI strategies that drive innovation, optimize processes, and unlock new opportunities for growth.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <Button variant="purple" className="rounded-xl px-8 py-3.5 flex items-center gap-2 group">
                  Explore more
                  <SafeIcon icon={FiIcons.FiArrowUpRight} className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Button>
              </motion.div>
            </div>

            {/* Bottom text - pushed to the bottom of the sticky container */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="mt-24 lg:mt-32 ml-16 lg:ml-24"
            >
              
            </motion.div>
          </div>

          {/* Right Column (Scrolling List) */}
          <div className="lg:w-[55%] flex flex-col pt-8 lg:pt-0">
            {possibilitiesData.map((item, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
                className="flex flex-col sm:flex-row items-start gap-6 sm:gap-10 group"
              >
                {/* Image Container */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-full overflow-hidden bg-white mt-2 relative">
                  <div className="absolute inset-0 bg-white/50 z-10 mix-blend-overlay group-hover:opacity-0 transition-opacity duration-300"></div>
                  <img 
                    src={item.img} 
                    alt={item.title} 
                    className="w-full h-full object-cover mix-blend-multiply opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
                  />
                </div>

                {/* Text Content with Bottom Border */}
                <div className={`flex-1 pb-12 sm:pb-16 ${index !== possibilitiesData.length - 1 ? 'border-b border-gray-300' : ''} ${index !== 0 ? 'pt-2 sm:pt-4' : ''}`}>
                  <h3 className="text-[22px] font-medium text-[#111111] mb-4">
                    {item.title}
                  </h3>
                  <p className="text-slate-600 text-[15px] leading-relaxed max-w-[95%]">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};

export default Possibilities;