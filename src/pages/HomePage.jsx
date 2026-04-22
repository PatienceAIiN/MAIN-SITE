import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const HomePage = ({ content, onAction }) => {
  const featureCards = content.features?.cards || [];
  const serviceCards = content.platformPage?.cards || [];
  const productCards = content.productsPage?.products || [];
  const caseStudies = content.blogPage?.posts || [];
  const trustSignals = content.statement?.trustedHighlights || [];
  const [activeServiceTab, setActiveServiceTab] = useState(0);
  const activeService = serviceCards[activeServiceTab] || null;
  const activeVisual = useMemo(
    () => content.possibilities?.items?.[activeServiceTab]?.img || content.hero?.backgroundImage?.src,
    [activeServiceTab, content.hero?.backgroundImage?.src, content.possibilities?.items]
  );

  return (
    <main className="bg-[#fbfaf7] text-[#171717]">
      <section className="relative overflow-hidden px-6 pb-20 pt-32 md:pb-28 md:pt-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.10),_transparent_30%),radial-gradient(circle_at_right,_rgba(15,23,42,0.08),_transparent_30%),linear-gradient(180deg,#f7f4ee_0%,#fbfaf7_60%,#ffffff_100%)]" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(23,23,23,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(23,23,23,0.07) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
          <div>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mb-6 text-xs font-semibold uppercase tracking-[0.42em] text-[#6f6b63]">
              Product-first enterprise AI
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08 }} className="max-w-5xl text-5xl font-medium leading-[0.9] tracking-[-0.06em] md:text-7xl lg:text-[5.7rem]">
              Calm AI products
              <br />
              with real-world
              <br />
              delivery logic.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.16 }} className="mt-7 max-w-2xl text-lg leading-relaxed text-[#5f5a52] md:text-xl">
              {content.hero?.description}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.24 }} className="mt-10 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onAction(content.hero?.cta?.action || { type: 'route', to: '/platform' })}
                className="rounded-full bg-[#171717] px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-black"
              >
                {content.hero?.cta?.label || 'Explore Services'}
              </button>
              <button
                type="button"
                onClick={() => onAction({ type: 'modal', target: 'product-demo' })}
                className="rounded-full border border-[#171717] px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.16em] text-[#171717] transition hover:bg-[#171717] hover:text-white"
              >
                Request Demo
              </button>
            </motion.div>

            <div className="mt-10 flex flex-wrap gap-3">
              {trustSignals.map((signal) => (
                <span key={signal} className="rounded-full border border-[#d8d2c7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#4a453e]">
                  {signal}
                </span>
              ))}
            </div>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative rounded-[34px] border border-[#ddd6ca] bg-[#171717] p-4 shadow-[0_30px_90px_rgba(23,23,23,0.16)]">
            <div className="overflow-hidden rounded-[26px]">
              <img src={content.hero?.backgroundImage?.src} alt={content.hero?.backgroundImage?.alt} className="h-[420px] w-full object-cover opacity-90 md:h-[520px]" />
            </div>
            <div className="absolute inset-x-10 bottom-10 rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-white/70">Single source of truth</p>
              <p className="mt-3 text-lg font-medium leading-relaxed text-white">
                {content.statement?.headingPrefix} <span className="text-[#d8f2d0]">{content.statement?.headingHighlight}</span> {content.statement?.headingSuffix}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-white px-6 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.36em] text-[#6f6b63]">Value proposition</p>
              <h2 className="mt-4 max-w-4xl text-4xl font-medium leading-[0.95] tracking-[-0.05em] md:text-6xl">
                The new UI, now backed
                <br />
                by your live business logic.
              </h2>
            </div>
            <p className="max-w-xl text-lg leading-relaxed text-[#5f5a52]">{content.possibilities?.description}</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((card, index) => (
              <motion.article
                key={`${card.title}-${index}`}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="rounded-[28px] border border-[#e2dbcf] bg-[#fbfaf7] p-6 shadow-[0_16px_45px_rgba(23,23,23,0.04)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6f6b63]">0{index + 1}</p>
                <h3 className="mt-5 text-2xl font-medium leading-tight tracking-[-0.04em]">{card.title}</h3>
                <p className="mt-4 text-base leading-relaxed text-[#5f5a52]">{card.description || card.variant}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f4f1ea] px-6 py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.36fr_0.64fr]">
          <div className="flex gap-3 overflow-x-auto pb-2 lg:flex-col">
            {serviceCards.map((card, index) => (
              <button
                key={card.title}
                type="button"
                onClick={() => setActiveServiceTab(index)}
                className={`min-w-max rounded-[20px] border px-5 py-4 text-left transition ${activeServiceTab === index ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#d8d2c7] bg-white text-[#171717]'}`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-70">Service</p>
                <p className="mt-2 text-lg font-medium">{card.title}</p>
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-[34px] border border-[#d8d2c7] bg-white p-4 shadow-[0_24px_70px_rgba(23,23,23,0.06)]">
            <div className="grid gap-8 lg:grid-cols-[0.48fr_0.52fr]">
              <AnimatePresence mode="wait">
                <motion.div key={activeVisual} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="relative min-h-[360px] overflow-hidden rounded-[28px] bg-[#ebe6dc]">
                  <img src={activeVisual} alt={activeService?.title} className="absolute inset-0 h-full w-full object-cover" />
                </motion.div>
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.div key={activeService?.title || 'service'} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col px-3 py-4 md:px-5 md:py-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#6f6b63]">Services</p>
                  <h3 className="mt-4 text-4xl font-medium leading-[0.96] tracking-[-0.05em]">{activeService?.title}</h3>
                  <p className="mt-4 text-lg leading-relaxed text-[#5f5a52]">{activeService?.description}</p>

                  <div className="mt-8 space-y-3">
                    {(activeService?.points || []).map((point) => (
                      <div key={point.title} className="rounded-[20px] border border-[#e2dbcf] bg-[#fbfaf7] p-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#171717]">{point.title}</p>
                        <p className="mt-2 text-sm leading-relaxed text-[#5f5a52]">{point.description}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => onAction({ type: 'route', to: '/platform' })}
                    className="mt-8 w-fit rounded-full bg-[#171717] px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-black"
                  >
                    Explore Services
                  </button>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.36em] text-[#6f6b63]">Products</p>
              <h2 className="mt-4 text-4xl font-medium leading-[0.95] tracking-[-0.05em] md:text-6xl">
                Product surfaces that stay
                <br />
                elegant under real load.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onAction({ type: 'route', to: '/products' })}
              className="rounded-full border border-[#171717] px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#171717] transition hover:bg-[#171717] hover:text-white"
            >
              View All Products
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {productCards.map((product, index) => (
              <motion.article
                key={product.id}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.42, delay: index * 0.08 }}
                className="overflow-hidden rounded-[30px] border border-[#e2dbcf] bg-[#fbfaf7] shadow-[0_18px_55px_rgba(23,23,23,0.05)]"
              >
                <div className="border-b border-[#e2dbcf] px-7 py-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6f6b63]">Product 0{index + 1}</p>
                  <h3 className="mt-4 text-3xl font-medium tracking-[-0.04em]">{product.name}</h3>
                  <p className="mt-3 text-lg leading-relaxed text-[#5f5a52]">{product.summary}</p>
                </div>
                <div className="px-7 py-6">
                  <div className="flex flex-wrap gap-2">
                    {product.technologies.slice(0, 4).map((technology) => (
                      <span key={technology} className="rounded-full border border-[#d8d2c7] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#4a453e]">
                        {technology}
                      </span>
                    ))}
                  </div>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'modal', target: 'product-demo', product })}
                      className="rounded-full bg-[#171717] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white"
                    >
                      Request Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'modal', target: 'sales' })}
                      className="rounded-full border border-[#171717] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#171717]"
                    >
                      Talk to Sales
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#171717] py-20 text-white md:py-24">
        <div className="marquee-track">
          {[...caseStudies, ...caseStudies].map((post, index) => (
            <article key={`${post.slug}-${index}`} className={`marquee-card ${index % 2 === 0 ? 'bg-[#faf6ee] text-[#171717]' : 'bg-[#2b2b2b] text-white'}`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.34em] opacity-70">{post.header}</p>
                <h3 className="mt-5 text-3xl font-medium leading-tight tracking-[-0.04em]">{post.title}</h3>
                <p className="mt-5 text-base leading-relaxed opacity-80">{post.excerpt}</p>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] opacity-70">{post.by}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#f4f1ea] px-6 py-20 md:py-28">
        <div className="mx-auto max-w-7xl rounded-[34px] border border-[#d8d2c7] bg-white px-7 py-10 shadow-[0_24px_70px_rgba(23,23,23,0.06)] md:px-12 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-[#6f6b63]">Final CTA</p>
          <h2 className="mt-4 max-w-4xl text-4xl font-medium leading-[0.95] tracking-[-0.05em] md:text-6xl">
            {content.ctaBanner?.heading}
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#5f5a52]">{content.ctaBanner?.description}</p>

          <div className="mt-10 flex flex-wrap gap-3">
            {(content.ctaBanner?.buttons || []).map((button) => (
              <button
                key={button.label}
                type="button"
                onClick={() => onAction(button.action)}
                className="rounded-full bg-[#171717] px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-black"
              >
                {button.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onAction({ type: 'route', to: '/contact' })}
              className="rounded-full border border-[#171717] px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#171717] transition hover:bg-[#171717] hover:text-white"
            >
              Contact Team
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
