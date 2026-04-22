import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiMinus } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const faqs = [
  {
    question: "Why don't I just hire a team full time?",
    answer: "Hiring a full-time team means managing payroll, benefits, and constant training. We provide an entire team of specialists for a fraction of the cost, ready to execute immediately without the overhead."
  },
  {
    question: "How quickly will I see results?",
    answer: "Most of our clients see a noticeable shift in CPA and ROAS within the first 14 to 30 days as new creative tests begin compounding and we identify winning angles."
  },
  {
    question: "How do you brief creative without wasting my time?",
    answer: "We use our proprietary system to pull your customer data, competitor ads, and market trends. You just approve the concepts; we handle the heavy lifting and research."
  },
  {
    question: "Is my brand a good fit?",
    answer: "We work best with DTC brands spending at least $50k/mo on paid social who are bottlenecked by creative production and testing capacity, not media buying."
  },
  {
    question: "Who's not a good fit?",
    answer: "Drop-shippers, pre-product-market fit startups, and brands with very low AOV or margins usually struggle to see the ROI from high-volume creative testing."
  },
  {
    question: "What if it doesn't work?",
    answer: "We test iteratively. If a format fails, we know exactly why and pivot immediately. Our process is designed to find winners quickly, mitigating prolonged wasted spend."
  }
];

const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      className="border-b border-[#d1d1d1] py-6 cursor-pointer group"
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className="flex justify-between items-center">
        <h4 className="text-[20px] md:text-[22px] text-[#1a1a1a] font-sans tracking-tight pr-8 group-hover:text-black transition-colors">
          {question}
        </h4>
        <div className="text-[#1a1a1a] flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
          {isOpen ? <FiMinus size={24} strokeWidth={1} /> : <FiPlus size={24} strokeWidth={1} />}
        </div>
      </div>
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[500px] mt-4 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-[#666666] text-lg leading-relaxed pr-8">
          {answer}
        </p>
      </div>
    </div>
  );
};

const FAQSection = () => {
  return (
    <section className="py-24 md:py-32 bg-[#f4f4f4] px-6">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 lg:gap-24">
        
        {/* Left Column: FAQ Accordion */}
        <div className="lg:w-3/5">
          <h2 className="text-6xl md:text-[5.5rem] text-[#a3a3a3] font-sans tracking-tighter leading-[0.9] mb-12 md:mb-16">
            Frequently asked<br />questions
          </h2>
          
          <div className="flex flex-col border-t border-[#d1d1d1]">
            {faqs.map((faq, index) => (
              <FAQItem 
                key={index}
                question={faq.question}
                answer={faq.answer}
              />
            ))}
          </div>
        </div>

        {/* Right Column: Audit Card */}
        <div className="lg:w-2/5">
          <div className="bg-[#e6e6e6] rounded-[20px] p-8 md:p-12 flex flex-col h-full sticky top-32">
            
            {/* Card Content */}
            <h3 className="text-4xl md:text-[2.75rem] font-sans font-medium tracking-tighter text-[#1a1a1a] mb-6 leading-[1.05]">
              Get your free creative audit
            </h3>
            
            <p className="text-[#666666] text-lg leading-relaxed mb-8 flex-grow">
              In 20 minutes we'll review your current creative, show you where performance is leaking, and tell you exactly what we'd test first. No pitch. Just data. If we're not the right fit, we'll tell you that too.
            </p>
            
            <Link 
              to="/contact"
              className="bg-[#1a1a1a] text-white px-8 py-4 rounded-[4px] font-medium hover:bg-black transition-colors duration-300 w-fit mt-auto inline-block text-center"
            >
              See if you qualify
            </Link>

          </div>
        </div>

      </div>
    </section>
  );
};

export default FAQSection;