import React from 'react';
import Hero from '../components/Hero';
import ValueProposition from '../components/ValueProposition';
import FeatureScroll from '../components/FeatureScroll';
import ServicesTabs from '../components/ServicesTabs';
import TechnologyStack from '../components/TechnologyStack';
import OurApproach from '../components/OurApproach';
import FAQSection from '../components/FAQSection';
import FinalCTA from '../components/FinalCTA';

const Home = () => {
  return (
    <div className="flex flex-col w-full">
      <Hero />
      <ValueProposition />
      <FeatureScroll />
      <ServicesTabs />
      <TechnologyStack />
      <OurApproach />
      <FAQSection />
      <FinalCTA />
    </div>
  );
};

export default Home;