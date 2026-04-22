import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMonitor, FiShoppingBag, FiCloud, FiCpu, FiArrowRight } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const servicesData = [
  {
    id: 'digital-transformation',
    tabTitle: 'Digital Transformation',
    icon: FiMonitor,
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=2070&auto=format&fit=crop',
    title: 'Digital Transformation',
    description: 'Digitize and automate complex workflows with our responsive software solutions. Modernity, experience, scalability, security, performance — all check.',
    technologies: ['Java', 'Python', 'Node.js', '.NET', 'PHP', 'Go', 'React', 'Angular', 'Vue.js', 'Next.js', 'Flutter', 'React Native', 'Swift', 'Kotlin', 'Microsoft', 'Salesforce', 'SAP', 'ServiceNow'],
    ctaText: 'Elevate Digital Transformation Journey'
  },
  {
    id: 'ecommerce-development',
    tabTitle: 'eCommerce Development',
    icon: FiShoppingBag,
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=2070&auto=format&fit=crop',
    title: 'eCommerce Development',
    description: 'Having developed eCommerce engines for hundreds of businesses including Fortune 500 companies, PatienceAI offers strong capability in the domain of high-performance digital retail.',
    technologies: ['Shopify', 'Shopify +', 'Adobe Commerce', 'Adobe Commerce Cloud', 'WooCommerce', 'PrestaShop', 'BigCommerce', 'Drupal', 'Oracle Commerce', 'SAP Commerce', 'Salesforce Commerce'],
    ctaText: 'Boost Your Online Store'
  },
  {
    id: 'cloud-devops',
    tabTitle: 'Cloud & DevOps',
    icon: FiCloud,
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop',
    title: 'Cloud & DevOps',
    description: 'We get you robust cloud infrastructure combined with DevOps best practices to deliver scalable, high-performing, and continuously optimized applications—no matter the load.',
    technologies: ['Amazon Web Services (AWS)', 'Microsoft Azure', 'Google Cloud Platform', 'IBM Cloud', 'Oracle Cloud Infrastructure (OCI)', 'Terraform', 'Ansible', 'Pulumi', 'Jenkins', 'GitHub', 'GitLab', 'Docker', 'Kubernetes', 'Prometheus', 'Grafana', 'SonarQube', 'Bash', 'Python', 'Go', 'Firebase'],
    ctaText: 'Scale Your Infrastructure'
  },
  {
    id: 'artificial-intelligence',
    tabTitle: 'Artificial Intelligence',
    icon: FiCpu,
    image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1965&auto=format&fit=crop',
    title: 'Artificial Intelligence',
    description: 'Automate decisions, maximize user experiences, and access deeper business insights with custom-trained AI models.',
    technologies: ['TensorFlow', 'PyTorch', 'Scikit-learn', 'JAX', 'Google Vertex AI', 'Amazon SageMaker', 'Azure Machine Learning', 'Databricks MLflow', 'OpenAI', 'Anthropic', 'Google Gemini', 'Meta Llama', 'Mistral AI', 'Hugging Face Transformers', 'LangChain', 'LlamaIndex', 'Pandas', 'NumPy', 'Apache Spark'],
    ctaText: 'Explore AI Solutions'
  }
];

const ServicesTabs = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="py-24 md:py-32 bg-white px-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Section Header with Branded Two-Tone Title */}
        <div className="mb-16 md:mb-20">
          <div className="inline-block px-4 py-1.5 bg-[#f4f4f4] border border-[#d1d1d1] text-sm font-medium rounded-full mb-6 text-[#1a1a1a]">
            Capabilities
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-[4rem] lg:text-[4.5rem] font-sans tracking-tighter leading-[1.05] mb-6">
            <span className="text-[#a3a3a3]">Our Core </span>
            <span className="text-[#1a1a1a] font-medium block sm:inline">Technology Services</span>
          </h2>
          <p className="text-lg md:text-xl text-[#666666] max-w-3xl leading-relaxed">
            From strengthening your digital presence to automating your workflow we offer technology services for end-to-end digital transformation.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Left Column: Tabs */}
          <div className="lg:w-1/4 flex lg:flex-col overflow-x-auto lg:overflow-visible gap-4 pb-4 lg:pb-0 scrollbar-hide">
            {servicesData.map((service, index) => (
              <button
                key={service.id}
                onClick={() => setActiveTab(index)}
                className={`flex-none lg:w-full text-left px-6 py-5 rounded-[12px] flex items-center gap-4 transition-all duration-300 font-medium text-sm md:text-base border ${
                  activeTab === index 
                    ? 'bg-[#1a1a1a] text-white border-[#1a1a1a] shadow-lg' 
                    : 'bg-[#f4f4f4] text-[#666666] border-transparent hover:bg-[#e6e6e6] hover:text-[#1a1a1a]'
                }`}
                style={{ minWidth: 'max-content' }}
              >
                <SafeIcon icon={service.icon} className={`text-xl ${activeTab === index ? 'text-white' : 'text-[#1a1a1a]'}`} />
                {service.tabTitle}
              </button>
            ))}
          </div>

          {/* Right Column: Content Card */}
          <div className="lg:w-3/4">
            <div className="bg-white border border-[#e5e5e5] rounded-[24px] p-2 md:p-3 shadow-sm lg:h-[500px] flex overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="flex flex-col lg:flex-row w-full h-full gap-6 lg:gap-8"
                >
                  {/* Image Section */}
                  <div className="lg:w-[45%] h-[200px] lg:h-full rounded-[16px] overflow-hidden relative flex-shrink-0">
                    <div className="absolute top-4 left-4 bg-white p-2.5 rounded-xl shadow-lg z-10">
                      <SafeIcon icon={servicesData[activeTab].icon} className="text-xl text-[#1a1a1a]" />
                    </div>
                    <img 
                      src={servicesData[activeTab].image} 
                      alt={servicesData[activeTab].title} 
                      className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition-all duration-700"
                    />
                  </div>

                  {/* Text Content Section */}
                  <div className="lg:w-[55%] py-4 lg:py-6 pr-4 lg:pr-6 flex flex-col h-full overflow-y-auto scrollbar-hide">
                    <h3 className="text-2xl md:text-[28px] font-sans font-medium tracking-tight text-[#1a1a1a] mb-2 leading-tight">
                      {servicesData[activeTab].title}
                    </h3>
                    <p className="text-[#666666] text-[14px] md:text-[15px] leading-relaxed mb-4">
                      {servicesData[activeTab].description}
                    </p>

                    {/* Key Technologies Divider */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-[1px] bg-[#e5e5e5] flex-1"></div>
                      <span className="text-[10px] font-bold tracking-[0.2em] text-[#a3a3a3] uppercase flex-shrink-0">
                        Key Technologies
                      </span>
                      <div className="h-[1px] bg-[#e5e5e5] flex-1"></div>
                    </div>

                    {/* Technologies Pills */}
                    <div className="flex flex-wrap gap-1.5 mb-6">
                      {servicesData[activeTab].technologies.map((tech, idx) => (
                        <span 
                          key={idx} 
                          className="px-2.5 py-1 rounded-full border border-[#d1d1d1] text-[11px] font-medium text-[#1a1a1a] bg-white hover:border-[#1a1a1a] transition-colors cursor-default"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>

                    {/* CTA Button */}
                    <div className="mt-auto pt-2">
                      <Link 
                        to="/contact" 
                        className="bg-[#1a1a1a] text-white px-5 py-3 rounded-[4px] font-medium hover:bg-black transition-colors duration-300 w-fit flex items-center gap-2 group text-sm"
                      >
                        {servicesData[activeTab].ctaText}
                        <SafeIcon icon={FiArrowRight} className="text-base group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServicesTabs;