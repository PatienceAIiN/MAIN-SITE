import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import FinalCTA from '../components/FinalCTA';

const fallbackUseCases = [
  {
    id: 'shipping-a-low-friction-demo-flow',
    title: 'Shipping a low-friction demo flow for enterprise AI',
    client: 'Patience AI',
    category: 'Case Study',
    image: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=2070&auto=format&fit=crop',
    summary: 'How we keep demo requests contextual, fast, and routed to the right owner without adding friction.',
    content: []
  }
];

const UseCases = ({ siteContent }) => {
  const [activePost, setActivePost] = useState(null);
  const posts = (siteContent?.blogPage?.posts || fallbackUseCases).map((post, index) => ({
    id: post.slug || post.id || `post-${index}`,
    title: post.title,
    client: post.by || 'Patience AI',
    category: post.header || 'Case Study',
    image: `https://images.unsplash.com/photo-${index % 3 === 0 ? '1516321497487-e288fb19713f' : index % 3 === 1 ? '1557200134-90327ee9fafa' : '1556742049-0cfed4f6a45d'}?q=80&w=2070&auto=format&fit=crop`,
    summary: post.excerpt,
    content: (post.content || []).map((text) => ({ type: 'p', text }))
  }));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activePost]);

  return (
    <div className="flex w-full flex-col bg-white">
      {!activePost ? (
        <>
          <div className="relative overflow-hidden bg-[#f4f4f4] px-6 pb-16 pt-48 text-center">
            <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            <div className="relative z-10 mx-auto max-w-4xl">
              <div className="mb-8 inline-block rounded-full border border-[#d1d1d1] bg-white px-4 py-1.5 text-sm font-medium text-[#1a1a1a] shadow-sm animate-fade-rise">
                {siteContent?.blogPage?.hero?.eyebrow || 'Success Stories'}
              </div>
              <h1 className="mb-8 text-5xl font-serif leading-[1.05] tracking-tight text-[#1a1a1a] animate-fade-rise-delay md:text-7xl">
                {siteContent?.blogPage?.hero?.title || 'Use Cases'}
              </h1>
              <p className="mx-auto max-w-2xl text-xl leading-relaxed text-[#666666] animate-fade-rise-delay-2">
                {siteContent?.blogPage?.hero?.description || 'See how industry leaders are leveraging PatienceAI to solve their most complex technical challenges and scale their operations.'}
              </p>
            </div>
          </div>

          <section className="mx-auto w-full max-w-7xl px-6 py-24">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12 lg:grid-cols-3">
              {posts.map((useCase, index) => (
                <div
                  key={useCase.id}
                  className="group flex cursor-pointer flex-col overflow-hidden rounded-[24px] border border-[#e5e5e5] bg-white shadow-sm transition-all duration-500 hover:border-[#d1d1d1] hover:shadow-xl"
                  onClick={() => setActivePost(useCase)}
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="relative h-64 w-full overflow-hidden bg-[#f4f4f4]">
                    <img src={useCase.image} alt={useCase.title} className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105 group-hover:grayscale-0" />
                    <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#1a1a1a] shadow-sm backdrop-blur-sm">
                      {useCase.category}
                    </div>
                  </div>
                  <div className="flex flex-grow flex-col p-8">
                    <h3 className="mb-4 text-2xl font-medium tracking-tight text-[#1a1a1a] transition-colors group-hover:text-black">{useCase.title}</h3>
                    <p className="mb-8 flex-grow text-base leading-relaxed text-[#666666]">{useCase.summary}</p>
                    <div className="mt-auto flex items-center gap-3 text-sm font-medium text-[#1a1a1a] transition-transform group-hover:translate-x-1">
                      Read Full Story <SafeIcon icon={FiArrowRight} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <FinalCTA />
        </>
      ) : (
        <div className="animate-fade-rise">
          <div className="relative overflow-hidden border-b border-[#e5e5e5] bg-[#f4f4f4] px-6 pb-20 pt-40">
            <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            <div className="relative z-10 mx-auto max-w-4xl">
              <button onClick={() => setActivePost(null)} className="group mb-12 flex w-fit items-center gap-2 text-sm font-medium text-[#666666] transition-colors hover:text-[#1a1a1a]">
                <SafeIcon icon={FiArrowLeft} className="transition-transform group-hover:-translate-x-1" />
                Back to Use Cases
              </button>

              <div className="mb-8 flex items-center gap-4">
                <span className="rounded-full border border-[#d1d1d1] bg-white px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#1a1a1a]">
                  {activePost.category}
                </span>
                <span className="text-sm font-medium text-[#666666]">Client: {activePost.client}</span>
              </div>

              <h1 className="text-4xl font-medium leading-[1.1] tracking-tight text-[#1a1a1a] md:text-5xl lg:text-6xl">{activePost.title}</h1>
            </div>
          </div>

          <div className="relative z-20 mx-auto -mt-12 max-w-5xl px-6">
            <div className="aspect-[21/9] w-full overflow-hidden rounded-[24px] bg-[#e5e5e5] shadow-2xl">
              <img src={activePost.image} alt={activePost.title} className="h-full w-full object-cover" />
            </div>
          </div>

          <article className="mx-auto max-w-3xl px-6 py-24">
            <div className="prose prose-lg prose-neutral max-w-none">
              <p className="mb-16 text-xl font-medium leading-relaxed text-[#666666] md:text-2xl">{activePost.summary}</p>

              {activePost.content.map((block, idx) => {
                if (block.type === 'h3') {
                  return (
                    <h3 key={idx} className="mb-6 mt-16 text-3xl font-medium tracking-tight text-[#1a1a1a]">
                      {block.text}
                    </h3>
                  );
                }
                if (block.type === 'p') {
                  return (
                    <p key={idx} className="mb-8 text-lg leading-relaxed text-[#4a4a4a]">
                      {block.text}
                    </p>
                  );
                }
                return null;
              })}
            </div>

            <div className="mt-24 flex flex-col items-center justify-between gap-8 border-t border-[#e5e5e5] pt-12 sm:flex-row">
              <div>
                <h4 className="mb-2 text-2xl font-medium text-[#1a1a1a]">Ready to achieve similar results?</h4>
                <p className="text-[#666666]">Let&apos;s discuss how we can transform your infrastructure.</p>
              </div>
              <Link to="/contact" className="whitespace-nowrap rounded-[4px] bg-[#1a1a1a] px-8 py-4 text-center font-medium text-white transition-colors duration-300 hover:bg-black">
                Reach Out
              </Link>
            </div>
          </article>
        </div>
      )}
    </div>
  );
};

export default UseCases;
