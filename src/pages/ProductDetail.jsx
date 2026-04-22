import React, { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { FiArrowRight, FiCheckCircle, FiArrowLeft } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const productData = {
  'law-firm': {
    title: 'Law Firm Case Management System',
    subtitle: 'Smart, centralized legal operations with seamless case tracking, automation, and client collaboration.',
    image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=2070&auto=format&fit=crop',
    problem: {
      text: 'Modern law firms are still operating on outdated systems — juggling spreadsheets, emails, and physical files to manage critical legal operations. This fragmented approach creates inefficiencies at every level.',
      points: [
        'Case data is scattered across multiple tools, making tracking difficult',
        'Manual processes increase the risk of errors and missed deadlines',
        'Communication gaps between admins, advocates, and clients slow down workflows',
        'Important updates like court dates or payments can easily be overlooked',
        'Scaling operations becomes challenging without a centralized system'
      ],
      conclusion: 'As case volumes grow, these inefficiencies compound, directly impacting productivity, client satisfaction, and overall firm performance.'
    },
    solution: {
      text: 'To address these challenges, we built a unified digital platform tailored for law firms — designed to simplify operations, improve visibility, and automate repetitive tasks.',
      points: [
        'A centralized system that brings cases, documents, payments, and communication together',
        'Real-time tracking of case progress with clear status updates',
        'Automated reminders and notifications to eliminate missed deadlines',
        'Role-based access for secure collaboration between admins and advocates',
        'Seamless integration of all operational workflows into one scalable solution'
      ],
      conclusion: 'The result is a smarter, faster, and more reliable way to run a law firm.'
    },
    features: {
      text: 'The platform is built to handle the complete lifecycle of legal operations while remaining intuitive and easy to use.',
      points: [
        'Comprehensive case management with detailed tracking and status updates',
        'Dedicated portals for admins and advocates to streamline responsibilities',
        'Secure document management with organized storage and easy access',
        'Integrated payment tracking with automated receipt generation',
        'Email notifications for case updates, reminders, and client communication',
        'Consultation booking system with real-time availability management',
        'Testimonial and client interaction management tools',
        'AI-powered chatbot for handling basic client queries',
        'Fully customizable admin dashboard for managing content and operations'
      ],
      conclusion: 'Each feature is designed to reduce manual effort and improve operational efficiency.'
    },
    techStack: {
      text: 'Built using modern, scalable technologies to ensure performance, security, and flexibility.',
      points: [
        'Frontend powered by Next.js, React, and TypeScript for a fast and responsive UI',
        'Backend built on Node.js with API-driven architecture',
        'PostgreSQL database with Prisma ORM for reliable and structured data handling',
        'Secure authentication using NextAuth with JWT-based sessions',
        'Email communication powered by Brevo (Sendinblue)',
        'AI capabilities integrated using GROQ API',
        'PDF generation using pdf-lib for professional documents',
        'Deployment-ready architecture compatible with Vercel and Docker'
      ]
    }
  },
  'pariksha': {
    title: 'PrepEdgeAI',
    subtitle: 'Smart, adaptive exam preparation powered by AI-driven personalization, real-time feedback, and performance-focused learning.',
    image: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=2070&auto=format&fit=crop',
    problem: {
      text: 'Exam preparation today is often generic, static, and inefficient. Learners spend hours on irrelevant content without clear direction or measurable progress.',
      points: [
        'One-size-fits-all learning approaches ignore individual strengths and weaknesses',
        'Lack of real-time feedback makes it hard to identify mistakes early',
        'Limited visibility into performance trends and improvement areas',
        'Traditional systems fail to adapt to learner behavior and pace',
        'Collaboration and guided learning environments are often missing'
      ],
      conclusion: 'As competition increases, these gaps make it harder for learners to stay focused, improve efficiently, and achieve better outcomes.'
    },
    solution: {
      text: 'PrepEdgeAI introduces an intelligent, adaptive learning platform designed to personalize exam preparation and maximize performance.',
      points: [
        'AI-driven system that adapts to individual learning patterns and progress',
        'Personalized recommendations to focus only on high-impact topics',
        'Real-time feedback loops for continuous improvement',
        'Structured practice environment with measurable performance tracking',
        'Seamless collaboration for guided and group-based learning'
      ],
      conclusion: 'The platform ensures learners spend time where it matters most, improving both efficiency and results.'
    },
    features: {
      text: 'PrepEdgeAI is designed to create a focused, data-driven learning experience.',
      points: [
        'Personalized learning paths based on performance and engagement',
        'Timed practice sessions with instant scoring and analytics',
        'AI-powered feedback on answers and reasoning quality',
        'Retrieval-based learning using advanced search and content matching',
        'Real-time collaboration for group study and instructor interaction',
        'Multi-device synchronization for uninterrupted learning',
        'Mobile-first experience with low-bandwidth optimization',
        'Offline resume capability for continuous access'
      ],
      conclusion: 'Each feature is built to enhance learning outcomes while reducing wasted effort.'
    },
    techStack: {
      text: 'Built on a modern AI-first architecture to ensure scalability, speed, and intelligence.',
      points: [
        'Frontend powered by React with a mobile-first architecture',
        'Backend built using Python (FastAPI) for scalable APIs and workflows',
        'Open-source LLMs (Mistral, LLaMA) for intelligent recommendations',
        'Retrieval-Augmented Generation (RAG) pipelines for contextual learning',
        'Vector databases (FAISS / pgvector) for semantic search',
        'WebSocket-based real-time systems for collaboration',
        'Cloud infrastructure with secure storage and offline support',
        'Privacy-focused data handling and scalable deployment'
      ],
      conclusion: 'This stack enables PrepEdgeAI to deliver a fast, adaptive, and intelligent learning experience at scale.'
    }
  },
  'ai-email': {
    title: 'Customer AI Email Platform',
    subtitle: 'Intelligent email automation with context-aware drafting, compliance controls, and actionable insights for high-volume communication.',
    image: 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?q=80&w=2070&auto=format&fit=crop',
    problem: {
      text: 'Enterprise teams managing customer communication face growing complexity and scale challenges.',
      points: [
        'High volume of emails leads to delays and inconsistent responses',
        'Manual drafting reduces productivity and increases operational costs',
        'Maintaining tone, compliance, and templates across teams is difficult',
        'Limited visibility into communication performance and effectiveness',
        'Lack of automation in workflows slows down response cycles'
      ],
      conclusion: 'As organizations scale, these inefficiencies directly impact customer experience and team efficiency.'
    },
    solution: {
      text: 'Customer AI Email Platform automates and optimizes email workflows using intelligent, context-aware systems.',
      points: [
        'AI-generated email drafts aligned with context, intent, and business policies',
        'Template enforcement to maintain consistency and compliance',
        'Automated workflows for faster response and reduced manual effort',
        'Centralized system for managing and tracking communication',
        'Built-in analytics to improve decision-making and performance'
      ],
      conclusion: 'The platform enables teams to scale communication without compromising quality or control.'
    },
    features: {
      text: 'Designed to enhance productivity, consistency, and insight across customer communication workflows.',
      points: [
        'Context-aware AI email drafting for accurate and relevant responses',
        'Predefined templates and policy enforcement for compliance',
        'Email classification and routing based on intent and priority',
        'Workflow automation for handling high-volume communication',
        'Analytics dashboard for tracking performance and engagement',
        'Secure system with role-based access and audit capabilities',
        'Integration-ready architecture for enterprise systems'
      ]
    },
    techStack: {
      text: 'Built for scalability, performance, and enterprise-grade reliability.',
      points: [
        'AI models for text generation and classification',
        'Backend with asynchronous processing for high-throughput systems',
        'Reactive frontend for smooth user experience',
        'Event-driven pipeline for ingestion, processing, and delivery',
        'Monitoring and retry mechanisms for reliability',
        'Secure infrastructure with compliance-focused design'
      ]
    }
  },
  'data-quality-flywheel': {
    title: 'Data Quality Flywheel System',
    subtitle: 'Continuous data validation and AI refinement system designed to improve model accuracy, reliability, and decision quality over time.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop',
    problem: {
      text: 'AI systems are only as reliable as the data they are trained and evaluated on. In complex domains like finance, poor data quality leads to inaccurate outputs and low trust.',
      points: [
        'Unstructured documents make data extraction difficult and error-prone',
        'Lack of validation leads to inconsistent or incorrect AI outputs',
        'Models struggle with reasoning, numerical accuracy, and domain context',
        'No continuous feedback loop to improve model performance over time',
        'Fragmented pipelines reduce scalability and maintainability'
      ],
      conclusion: 'Without a robust data quality system, AI solutions fail to deliver reliable and interpretable results.'
    },
    solution: {
      text: 'The Data Quality Flywheel System creates a continuous loop of data extraction, validation, and improvement to enhance AI performance over time.',
      points: [
        'Structured pipelines for extracting high-quality data from complex documents',
        'Multi-layer validation framework to ensure accuracy and consistency',
        'Judge models to evaluate and refine outputs through reasoning analysis',
        'Unified dataset system enabling multi-model benchmarking and evaluation',
        'Continuous learning loop that improves both data quality and model performance'
      ],
      conclusion: 'This creates a self-improving system where better data leads to better models, and better models further enhance data quality.'
    },
    features: {
      text: 'Built to ensure reliability, scalability, and continuous improvement in AI systems.',
      points: [
        'Domain-trained LLM pipelines for financial document intelligence',
        'OCR and semantic parsing using tools like Tesseract and OpenCV',
        'High-accuracy extraction and classification (90%+ performance benchmarks)',
        'Multi-model evaluation for regulatory reasoning and mathematical consistency',
        'Real-time validation for financial QA and inference tasks',
        'Continuous feedback loop with judge models for output refinement',
        'ETL pipelines for structured data processing and integration',
        'Secure data handling with scalable cloud infrastructure'
      ]
    },
    techStack: {
      text: 'Designed with a strong focus on AI, data engineering, and scalability.',
      points: [
        'LLMs including Mistral-7B and TinyLlama for domain-specific intelligence',
        'NLP tools such as SpaCy, Sentence Transformers, BERT, and FastText',
        'Vector search using FAISS for semantic retrieval',
        'Backend systems built with Python and FastAPI',
        'Databases including PostgreSQL and MongoDB',
        'OCR and parsing using Tesseract and OpenCV',
        'Machine learning frameworks like Scikit-learn and TensorFlow',
        'Cloud infrastructure on GCP with secure data pipelines and API integrations'
      ]
    }
  },
  'ace-compere': {
    title: 'Ace Compere – Employability AI Platform',
    subtitle: 'AI-powered career acceleration platform designed to enhance employability through intelligent automation, personalized insights, and end-to-end job application workflows.',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop',
    problem: {
      text: 'Job seekers face a fragmented and inefficient process when trying to improve employability and apply for roles.',
      points: [
        'Resume, cover letter, and LinkedIn optimization are often done manually',
        'Lack of personalized guidance for interview preparation and career improvement',
        'Job applications are repetitive, time-consuming, and inconsistent',
        'No unified system to track applications and measure progress',
        'Limited insights into employability or readiness for specific roles'
      ],
      conclusion: 'These challenges make the job search process slow, unstructured, and difficult to scale effectively.'
    },
    solution: {
      text: 'Ace Compere provides an AI-powered, end-to-end employability platform that streamlines and optimizes the entire job search journey.',
      points: [
        'Intelligent modules to enhance resumes, cover letters, and professional profiles',
        'AI-driven interview preparation with contextual feedback and guidance',
        'Automation tools to apply for jobs and track applications efficiently',
        'Centralized system for managing opportunities and progress',
        'Universal Employability Score (UES) to benchmark readiness and improvement'
      ],
      conclusion: 'The platform transforms job searching into a structured, data-driven, and efficient process.'
    },
    features: {
      text: 'Designed to cover the complete employability lifecycle with automation and intelligence.',
      points: [
        'ResumeAI, CoverLetterAI, and LinkedInAI for profile optimization',
        'InterviewAI for personalized preparation and feedback',
        'AutoApplyAI for automated job applications',
        'JobBoardAI for discovering relevant opportunities',
        'JobTrackerAI for tracking application progress and status',
        'Universal Employability Score (UES) for performance benchmarking',
        'Personalized recommendations based on user profile and activity',
        'End-to-end workflow management in a single platform'
      ]
    },
    techStack: {
      text: 'Built with a focus on scalability, flexibility, and AI integration.',
      points: [
        'Backend developed using Python for handling APIs and business logic',
        'Open-source AI models integrated via API keys for generation and analysis',
        'Frontend built with React for a fast and responsive user interface',
        'Modular architecture supporting automation workflows and data processing',
        'Secure handling of user data with scalable infrastructure'
      ]
    }
  }
};

const SectionBlock = ({ title, data, isDark }) => {
  if (!data) return null;

  return (
    <div className={`py-20 md:py-28 px-6 ${isDark ? 'bg-[#f4f4f4]' : 'bg-white'}`}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-5xl font-sans font-medium text-[#1a1a1a] mb-8 tracking-tight">
          {title}
        </h2>
        
        {data.text && (
          <p className="text-lg md:text-xl text-[#4a4a4a] leading-relaxed mb-10">
            {data.text}
          </p>
        )}

        {data.points && data.points.length > 0 && (
          <ul className="flex flex-col gap-5 mb-10">
            {data.points.map((point, idx) => (
              <li key={idx} className="flex items-start gap-4">
                <SafeIcon icon={FiCheckCircle} className="text-[#1a1a1a] text-xl mt-1 flex-shrink-0" />
                <span className="text-[#333333] text-lg leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        )}

        {data.conclusion && (
          <div className="bg-white border border-[#e5e5e5] p-6 rounded-xl shadow-sm">
            <p className="text-[#1a1a1a] font-medium text-lg leading-relaxed">
              {data.conclusion}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const ProductDetail = ({ siteContent }) => {
  const { id } = useParams();
  const siteProduct = siteContent?.productsPage?.products?.find((item) => item.id === id);
  const product = siteProduct
    ? {
        title: siteProduct.name,
        subtitle: siteProduct.shortTagline || siteProduct.summary,
        image: `https://images.unsplash.com/photo-${siteProduct.id === 'pariksha-ki-taiyari' ? '1516321497487-e288fb19713f' : '1557200134-90327ee9fafa'}?q=80&w=2070&auto=format&fit=crop`,
        problem: {
          text: siteProduct.summary,
          points: siteProduct.benefits || [],
          conclusion: siteProduct.audience
        },
        solution: {
          text: siteProduct.summary,
          points: siteProduct.benefits || [],
          conclusion: siteProduct.privacyTone
        },
        features: {
          text: siteProduct.summary,
          points: siteProduct.benefits || [],
          conclusion: ''
        },
        techStack: {
          text: 'Technology stack and platform capabilities used for this product.',
          points: siteProduct.technologies || []
        }
      }
    : productData[id];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!product) {
    return <Navigate to="/product" />;
  }

  return (
    <div className="flex flex-col w-full bg-white">
      {/* Hero Header - Changed to light theme so transparent Navbar text is visible */}
      <div className="pt-40 pb-20 md:pt-48 md:pb-28 px-6 relative overflow-hidden bg-[#f4f4f4] text-[#1a1a1a]">
        <div className="absolute inset-0 z-0">
          <img 
            src={product.image} 
            alt={product.title} 
            className="w-full h-full object-cover opacity-10 filter grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#f4f4f4]/80 to-[#f4f4f4]"></div>
        </div>
        
        <div className="max-w-5xl mx-auto relative z-10 animate-fade-rise">
          {/* Back Button */}
          <Link 
            to="/product" 
            className="flex items-center gap-2 text-[#666666] hover:text-[#1a1a1a] transition-colors mb-12 font-medium text-sm w-fit group"
          >
            <SafeIcon icon={FiArrowLeft} className="group-hover:-translate-x-1 transition-transform" /> Back to Products
          </Link>
          
          <div className="text-center">
            <div className="inline-block px-4 py-1.5 bg-white border border-[#d1d1d1] text-sm font-medium rounded-full mb-8 text-[#1a1a1a] shadow-sm">
              Case Study
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif mb-8 leading-[1.05] tracking-tight">
              {product.title}
            </h1>
            <p className="text-xl md:text-2xl text-[#666666] max-w-3xl mx-auto leading-relaxed">
              {product.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <SectionBlock title="The Problem" data={product.problem} isDark={false} />
      <SectionBlock title="Our Solution" data={product.solution} isDark={true} />
      <SectionBlock title="Key Features" data={product.features} isDark={false} />
      <SectionBlock title="Technology Stack" data={product.techStack} isDark={true} />

      {/* Bottom CTA */}
      <div className="py-24 md:py-32 px-6 bg-white text-center border-t border-[#e5e5e5]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-sans font-medium text-[#1a1a1a] mb-6 tracking-tight">
            Ready to explore {product.title}?
          </h2>
          <p className="text-lg text-[#666666] mb-12 leading-relaxed">
            Discover how our tailored solution can transform your operations and scale your business efficiently. Let's schedule a deep dive.
          </p>
          <Link 
            to="/contact" 
            className="bg-[#1a1a1a] text-white px-10 py-5 rounded-[4px] text-lg font-medium hover:bg-black transition-colors duration-300 inline-flex items-center gap-3 shadow-md"
          >
            Request Demo <SafeIcon icon={FiArrowRight} className="text-xl" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
