import React, { useState } from 'react';
import Hero from '../components/Hero';

const HomePage = ({ content, onAction }) => {
  const featureCards = content.features?.cards || [];
  const platformCards = content.platformPage?.cards || [];
  const blogPosts = content.blogPage?.posts || [];
  const [activeServiceTab, setActiveServiceTab] = useState(0);

  return (
    <main className="bg-white">
      <Hero content={content.hero} onAction={onAction} />

      <section className="bg-[#f4f4f4] px-4 py-16 sm:px-6 sm:py-24 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 md:mb-28">
            <h2 className="text-[2rem] leading-[1.05] tracking-[-0.04em] text-[#a3a3a3] sm:text-6xl md:text-[5.4rem]">
              Most AI products fail
              <br />
              <span className="text-[#1a1a1a]">before they feel inevitable</span>
            </h2>
          </div>

          <div className="grid gap-10 sm:gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
            <div className="flex flex-col">
              <p className="max-w-lg text-lg font-medium leading-relaxed text-[#1a1a1a]">
                {content.statement?.headingPrefix} {content.statement?.headingHighlight} {content.statement?.headingSuffix}
              </p>
              <div className="mt-10 sm:mt-14">
                <button
                  type="button"
                  onClick={() => onAction(content.ctaBanner?.buttons?.[0]?.action || { type: 'route', to: '/products' })}
                  className="inline-flex w-full items-center justify-center gap-4 rounded-[4px] bg-[#222222] px-6 py-4 text-sm font-semibold tracking-[0.08em] text-white transition-colors duration-300 hover:bg-black sm:w-auto"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-40" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.55)]" />
                  </span>
                  Explore what we build
                </button>
              </div>
            </div>

            <div className="flex flex-col">
              {featureCards.map((card, index) => (
                <div
                  key={`${card.title}-${index}`}
                  className={`flex items-start gap-4 sm:gap-6 border-t border-[#d1d1d1] py-6 sm:py-8 ${
                    index === featureCards.length - 1 ? 'border-b' : ''
                  }`}
                >
                  <span className="mt-1 text-xl text-[#1a1a1a]">{'->'}</span>
                  <div>
                    <p className="text-lg leading-snug text-[#1a1a1a]">{card.title}</p>
                    {card.description ? (
                      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#666666]">{card.description}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 sm:py-24 md:py-32">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row">
          <div className="flex gap-3 overflow-x-auto pb-4 lg:w-1/4 lg:flex-col lg:overflow-visible">
            {platformCards.map((card, index) => (
              <button
                key={card.title}
                type="button"
                onClick={() => setActiveServiceTab(index)}
                className={`min-w-max rounded-[12px] border px-5 py-4 text-left text-sm font-medium transition-all duration-300 lg:w-full ${
                  activeServiceTab === index
                    ? 'border-[#d1d1d1] bg-white text-[#1a1a1a] shadow-sm'
                    : 'border-transparent bg-[#f4f4f4] text-[#666666] hover:border-[#d1d1d1] hover:bg-[#e6e6e6] hover:text-[#1a1a1a]'
                }`}
              >
                {card.title}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-[24px] border border-[#e5e5e5] bg-white p-2.5 sm:p-3 shadow-sm lg:w-3/4">
            <div className="grid gap-8 lg:grid-cols-[0.45fr_0.55fr] lg:gap-12">
              <div className="relative min-h-[320px] overflow-hidden rounded-[16px] bg-[#f4f4f4]">
                <img
                  src={content.hero.backgroundImage?.src}
                  alt={content.hero.backgroundImage?.alt}
                  className="h-full w-full object-cover grayscale"
                />
              </div>

              <div className="flex flex-col px-3 py-5 sm:px-4 sm:py-6 lg:pr-10 lg:pt-10">
                <h3 className="mb-4 text-3xl font-medium tracking-tight text-[#1a1a1a] md:text-4xl">
                  {content.platformPage?.hero?.title}
                </h3>
                <p className="mb-10 text-base leading-relaxed text-[#666666] md:text-lg">
                  {content.platformPage?.hero?.description}
                </p>

                <div className="mb-10 flex flex-wrap gap-2">
                  {platformCards.flatMap((card) => card.points).map((point) => (
                    <span
                      key={point.title}
                      className="rounded-full border border-[#d1d1d1] bg-white px-4 py-2 text-[13px] font-medium text-[#1a1a1a]"
                    >
                      {point.title}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => onAction({ type: 'route', to: '/platform' })}
                  className="mt-auto inline-flex w-full items-center justify-center gap-3 rounded-[4px] bg-[#1a1a1a] px-8 py-4 text-sm font-semibold tracking-[0.08em] text-white transition-colors duration-300 hover:bg-black sm:w-fit"
                >
                  Explore Services
                  <span>{'->'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f2f2f2] py-24 md:py-32">
        <div className="marquee-track">
          {[...blogPosts, ...blogPosts].map((post, index) => (
            <article
              key={`${post.slug}-${index}`}
              className={`marquee-card ${
                index % 3 === 0 ? 'bg-[#1c1c1c] text-white' : index % 3 === 1 ? 'bg-[#5e5e5e] text-white' : 'bg-[#b3b3b3] text-[#1a1a1a]'
              }`}
            >
              <div>
                <p className="mb-8 text-3xl font-bold tracking-tight">{post.header}</p>
                <h3 className="mb-8 text-[16px] leading-relaxed opacity-90">{post.excerpt}</h3>
              </div>
              <div>
                <p className="text-base font-medium tracking-wide">{post.by}</p>
                <p className="mt-1 text-sm opacity-70">{post.title}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#f4f4f4] px-4 py-16 sm:px-6 sm:py-24 md:py-32">
        <div className="mx-auto max-w-7xl">
          <h2 className="max-w-4xl text-[2rem] font-medium leading-[1.05] tracking-[-0.04em] text-[#1a1a1a] sm:text-5xl md:text-[5.5rem]">
            {content.ctaBanner?.heading}
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#666666]">{content.ctaBanner?.description}</p>

          <div className="mt-12 sm:mt-16 flex flex-col overflow-hidden rounded-[8px] border border-[#1a1a1a] bg-white md:flex-row">
            {content.ctaBanner?.buttons?.map((button, index) => (
              <button
                key={button.label}
                type="button"
                onClick={() => onAction(button.action)}
                className={`flex flex-1 items-center justify-center gap-2 px-6 py-8 text-xl font-medium tracking-tight text-[#1a1a1a] transition-all duration-300 hover:bg-[#1a1a1a] hover:text-white md:px-8 md:py-16 md:text-[28px] ${
                  index === 0 ? 'border-b border-[#1a1a1a] md:border-b-0 md:border-r' : ''
                }`}
              >
                {button.label}
                <span>{'->'}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
