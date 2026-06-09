import React from 'react';
import Hero from '../components/Hero';
import ValueProposition from '../components/ValueProposition';
import Testimonials from '../components/Testimonials';
import ServicesTabs from '../components/ServicesTabs';
import FinalCTA from '../components/FinalCTA';

const Home = () => {
  return (
    <div className="flex flex-col w-full">
      <Hero />
      <ValueProposition />
      <Testimonials />
      <ServicesTabs />
      <FinalCTA />
    </div>
  );
};

export default Home;
