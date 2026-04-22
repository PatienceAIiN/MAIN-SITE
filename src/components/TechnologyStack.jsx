import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import Button from '../common/Button';
import { 
  FiMonitor, FiCpu, FiCode, FiShoppingBag, FiCloud, 
  FiArrowRight, FiChevronRight, FiDatabase, FiServer, 
  FiLayers, FiBox, FiSettings, FiCommand, FiGrid, FiLayout
} from 'react-icons/fi';
import { 
  FaSalesforce, FaAws, FaMicrosoft, FaHubspot, 
  FaReact, FaNodeJs, FaPython, FaJava, FaDocker, 
  FaShopify, FaStripe
} from 'react-icons/fa';

const techDomains = [
  {
    id: 'digital-transformation',
    title: 'Digital Transformation',
    icon: FiMonitor,
    description: 'Enterprise platforms for comprehensive digital transformation',
    technologies: [
      { name: 'Salesforce', icon: FaSalesforce },
      { name: 'SAP S/4HANA', icon: FiDatabase },
      { name: 'Microsoft Dynamics 365', icon: FaMicrosoft },
      { name: 'ServiceNow', icon: FiServer },
      { name: 'Mendix', icon: FiLayers },
      { name: 'OutSystems', icon: FiBox },
      { name: 'AWS', icon: FaAws },
      { name: 'HubSpot', icon: FaHubspot }
    ]
  },
  {
    id: 'ai-automation',
    title: 'AI & Automation',
    icon: FiCpu,
    description: 'Advanced AI models and robotic process automation tools',
    technologies: [
      { name: 'OpenAI', icon: FiCpu },
      { name: 'TensorFlow', icon: FiGrid },
      { name: 'PyTorch', icon: FiLayers },
      { name: 'UiPath', icon: FiSettings },
      { name: 'Automation Anywhere', icon: FiCommand },
      { name: 'Hugging Face', icon: FiBox },
      { name: 'Google Vertex AI', icon: FiCloud },
      { name: 'Azure ML', icon: FaMicrosoft }
    ]
  },
  {
    id: 'custom-software',
    title: 'Custom Software',
    icon: FiCode,
    description: 'Modern frameworks and languages for scalable applications',
    technologies: [
      { name: 'React & Next.js', icon: FaReact },
      { name: 'Node.js', icon: FaNodeJs },
      { name: 'Python', icon: FaPython },
      { name: 'Java & Spring', icon: FaJava },
      { name: 'PostgreSQL', icon: FiDatabase },
      { name: 'MongoDB', icon: FiServer },
      { name: 'Docker', icon: FaDocker },
      { name: 'GraphQL', icon: FiLayout }
    ]
  },
  {
    id: 'ecommerce',
    title: 'eCommerce Development',
    icon: FiShoppingBag,
    description: 'High-performance engines for digital retail experiences',
    technologies: [
      { name: 'Shopify Plus', icon: FaShopify },
      { name: 'Adobe Commerce', icon: FiShoppingBag },
      { name: 'WooCommerce', icon: FiBox },
      { name: 'BigCommerce', icon: FiLayers },
      { name: 'Stripe', icon: FaStripe },
      { name: 'Salesforce Commerce', icon: FaSalesforce },
      { name: 'Contentful', icon: FiLayout },
      { name: 'Algolia', icon: FiCommand }
    ]
  },
  {
    id: 'cloud-devops',
    title: 'DevOps & Cloud',
    icon: FiCloud,
    description: 'Robust infrastructure for continuous delivery and scale',
    technologies: [
      { name: 'AWS', icon: FaAws },
      { name: 'Microsoft Azure', icon: FaMicrosoft },
      { name: 'Google Cloud', icon: FiCloud },
      { name: 'Kubernetes', icon: FiBox },
      { name: 'Terraform', icon: FiLayers },
      { name: 'Jenkins', icon: FiSettings },
      { name: 'GitLab CI/CD', icon: FiCode },
      { name: 'Prometheus', icon: FiMonitor }
    ]
  }
];

const TechnologyStack = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="py-24 md:py-32 bg-[#fdfdfd] px-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Section Header */}
        <div className="mb-12 md:mb-16 text-center max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl md:text-[4rem] font-sans tracking-tighter leading-[1.05] mb-6">
            <span className="text-[#1a1a1a] font-medium">Our Technology </span>
            <span className="text-[#a3a3a3]">Stack and Platforms</span>
          </h2>
          <p className="text-lg md:text-xl text-[#666666] leading-relaxed mx-auto">
            Deep expertise across every major platform, framework, and emerging technology your business needs.
          </p>
        </div>

        {/* Main Interface Container */}
        <div className="bg-white border border-[#e5e5e5] rounded-[24px] lg:rounded-[32px] overflow-hidden flex flex-col lg:flex-row shadow-sm min-h-[600px]">
          
          {/* Left Sidebar: Domains */}
          <div className="lg:w-[320px] bg-[#f8f8f8] border-b lg:border-b-0 lg:border-r border-[#e5e5e5] p-6 lg:p-8 flex flex-col gap-2 flex-shrink-0">
            <h3 className="text-xl font-sans font-medium text-[#1a1a1a] mb-4 lg:mb-6 px-2">Technology Domains</h3>
            
            <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible gap-2 pb-2 lg:pb-0 scrollbar-hide">
              {techDomains.map((domain, index) => (
                <button
                  key={domain.id}
                  onClick={() => setActiveTab(index)}
                  className={`flex-none lg:w-full text-left px-4 py-3.5 rounded-[12px] flex items-center justify-between transition-all duration-300 font-medium text-sm md:text-[15px] border ${
                    activeTab === index 
                      ? 'bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-md' 
                      : 'bg-transparent text-[#666666] border-transparent hover:bg-[#e5e5e5] hover:text-[#1a1a1a]'
                  }`}
                  style={{ minWidth: 'max-content' }}
                >
                  <div className="flex items-center gap-3">
                    <SafeIcon icon={domain.icon} className={`text-[18px] ${activeTab === index ? 'text-white' : 'text-[#8c8c8c]'}`} />
                    {domain.title}
                  </div>
                  <SafeIcon 
                    icon={FiChevronRight} 
                    className={`hidden lg:block text-lg transition-transform duration-300 ${activeTab === index ? 'translate-x-1 opacity-100' : 'opacity-0 -translate-x-2'}`} 
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right Content Area: Technologies Grid */}
          <div className="flex-1 p-6 md:p-10 lg:p-12 flex flex-col bg-white">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col h-full"
              >
                {/* Domain Header inside content area */}
                <div className="flex items-start gap-5 mb-10">
                  <div className="w-14 h-14 rounded-2xl bg-[#f4f4f4] border border-[#e5e5e5] flex items-center justify-center flex-shrink-0">
                    <SafeIcon icon={techDomains[activeTab].icon} className="text-2xl text-[#1a1a1a]" />
                  </div>
                  <div>
                    <h3 className="text-2xl md:text-3xl font-sans font-medium text-[#1a1a1a] mb-2 tracking-tight">
                      {techDomains[activeTab].title}
                    </h3>
                    <p className="text-[#666666] text-sm md:text-base">
                      {techDomains[activeTab].description}
                    </p>
                  </div>
                </div>

                {/* Tech Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 mb-12">
                  {techDomains[activeTab].technologies.map((tech, idx) => (
                    <div 
                      key={idx} 
                      className="group bg-white border border-[#e5e5e5] hover:border-[#1a1a1a] rounded-[16px] p-5 md:p-6 flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] cursor-default aspect-square sm:aspect-auto sm:h-[140px]"
                    >
                      <SafeIcon 
                        icon={tech.icon} 
                        className="text-[32px] md:text-[40px] text-[#8c8c8c] group-hover:text-[#1a1a1a] transition-colors duration-300" 
                      />
                      <span className="font-medium text-[13px] md:text-sm text-[#1a1a1a] text-center leading-tight">
                        {tech.name}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <div className="mt-auto pt-4 flex justify-end border-t border-[#f4f4f4]">
                  <Button 
                    to="/services" 
                    variant="primary" 
                    size="sm" 
                    icon={FiArrowRight}
                  >
                    Explore Solutions
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>
    </section>
  );
};

export default TechnologyStack;