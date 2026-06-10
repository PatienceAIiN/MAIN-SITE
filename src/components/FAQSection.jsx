import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiMinus } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const faqs = [
  {
    question: "What does Patience AI actually build?",
    answer: "We build and run production-grade AI for your business: chat and voice agents that handle real customer conversations, retrieval (RAG) over your own documents so answers stay grounded, and workflow automation that connects those agents to the tools your team already uses."
  },
  {
    question: "How long does it take to go live?",
    answer: "Most teams start with a focused pilot and see a working agent on their own data within a couple of weeks, not quarters. We scope a clear success criterion upfront so you know what 'working' means before we build it."
  },
  {
    question: "Will the AI stay accurate and on-brand?",
    answer: "Every deployment ships with an evaluation harness, guardrails, and citations back to your source documents. Responses are grounded in your content, and you can review traces to see exactly why the agent said what it said."
  },
  {
    question: "How much does it cost?",
    answer: "Pricing depends on the channels, conversation volume, and integrations you need, so we scope it together rather than list a one-size number. Reach out and our team will put together a quote tailored to your use case."
  },
  {
    question: "Is my data secure and private?",
    answer: "Yes. We support role-based access, PII redaction, audit logs, and data residency options. Your documents are used to serve your agents and nothing else, and we can walk your security team through our setup."
  },
  {
    question: "What if it doesn't fit our use case?",
    answer: "We start small and measure honestly. If a pilot doesn't clear the success criteria we agreed on, we tell you plainly and adjust the approach rather than push you onto a long contract."
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
              Talk to our team
            </h3>

            <p className="text-[#666666] text-lg leading-relaxed mb-8 flex-grow">
              In a short call we'll learn how your team works, show you where AI can realistically help, and outline what we'd build first. No pitch. Just a clear plan and a quote tailored to your use case.
            </p>

            <Link
              to="/company/contact"
              className="bg-[#1a1a1a] text-white px-8 py-4 rounded-[4px] font-medium hover:bg-black transition-colors duration-300 w-fit mt-auto inline-block text-center"
            >
              Get a quote
            </Link>

          </div>
        </div>

      </div>
    </section>
  );
};

export default FAQSection;