import React from 'react';

const testimonials = [
  {
    id: 1,
    company: "Brand One",
    quote: "Exposure delivered incredibly visually engaging content. The team remained highly communicative and tested their assumptions rigorously.",
    author: "Sarah Jenkins",
    role: "Head of Marketing",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop",
    bgColor: "bg-[#1c1c1c]",
    textColor: "text-white",
    companyColor: "text-white"
  },
  {
    id: 2,
    company: "eucalyptus",
    quote: "Exposure delivered high-quality, performance-style creative with format and pacing all held to best-in-class standards. Gabe is a very knowledgeable and humble business partner who takes the time to deeply understand your customer pain points.",
    author: "Richie Wu",
    role: "Growth, Eucalyptus",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop", 
    bgColor: "bg-[#5e5e5e]",
    textColor: "text-white",
    companyColor: "text-[#c4c4c4]"
  },
  {
    id: 3,
    company: "TechFlow",
    quote: "The attention to detail and rigorous testing framework they brought to our creative process dropped our acquisition costs by 40% in the first month.",
    author: "Marcus Thorne",
    role: "Founder",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop",
    bgColor: "bg-[#b3b3b3]",
    textColor: "text-[#1a1a1a]",
    companyColor: "text-[#1a1a1a]"
  }
];

const Testimonials = () => {
  return (
    <section className="py-24 md:py-32 bg-[#f2f2f2] overflow-hidden relative">
      {/* CSS for Infinite Marquee */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: max-content;
          /* Adjust duration (40s) to make it slower or faster */
          animation: marquee 40s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="max-w-[100vw]">
        <div className="animate-marquee cursor-grab active:cursor-grabbing">
          
          {/* First Set of Cards */}
          <div className="flex gap-6 pr-6">
            {testimonials.map((testimonial) => (
              <div 
                key={`set1-${testimonial.id}`}
                className={`
                  flex-none w-[85vw] md:w-[60vw] lg:w-[45vw] xl:w-[35vw] 
                  rounded-[20px] p-10 md:p-14 lg:p-16 
                  flex flex-col justify-between
                  ${testimonial.bgColor} ${testimonial.textColor}
                `}
              >
                <div>
                  <h3 className={`text-3xl md:text-4xl font-serif font-bold tracking-tight mb-8 md:mb-12 ${testimonial.companyColor}`}>
                    {testimonial.company}
                  </h3>
                  {/* Changed to 16px and 400 font weight */}
                  <p className="text-[16px] font-normal leading-relaxed mb-12 md:mb-16 opacity-90 max-w-xl">
                    {testimonial.quote}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <img 
                    src={testimonial.avatar} 
                    alt={testimonial.author} 
                    className="w-14 h-14 rounded-full object-cover grayscale opacity-90"
                    draggable="false"
                  />
                  <div>
                    <p className="font-medium text-base tracking-wide">
                      {testimonial.author}
                    </p>
                    <p className="text-sm opacity-70 mt-0.5">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Second Set of Cards (Duplicate for seamless loop) */}
          <div className="flex gap-6 pr-6">
            {testimonials.map((testimonial) => (
              <div 
                key={`set2-${testimonial.id}`}
                className={`
                  flex-none w-[85vw] md:w-[60vw] lg:w-[45vw] xl:w-[35vw] 
                  rounded-[20px] p-10 md:p-14 lg:p-16 
                  flex flex-col justify-between
                  ${testimonial.bgColor} ${testimonial.textColor}
                `}
              >
                <div>
                  <h3 className={`text-3xl md:text-4xl font-serif font-bold tracking-tight mb-8 md:mb-12 ${testimonial.companyColor}`}>
                    {testimonial.company}
                  </h3>
                  {/* Changed to 16px and 400 font weight */}
                  <p className="text-[16px] font-normal leading-relaxed mb-12 md:mb-16 opacity-90 max-w-xl">
                    {testimonial.quote}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <img 
                    src={testimonial.avatar} 
                    alt={testimonial.author} 
                    className="w-14 h-14 rounded-full object-cover grayscale opacity-90"
                    draggable="false"
                  />
                  <div>
                    <p className="font-medium text-base tracking-wide">
                      {testimonial.author}
                    </p>
                    <p className="text-sm opacity-70 mt-0.5">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};

export default Testimonials;