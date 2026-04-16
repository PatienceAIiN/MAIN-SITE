import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import FadeIn from '../common/FadeIn';

const PlatformPage = ({ content, possibilityContent, onAction }) => {
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);

  useEffect(() => {
    if (!selectedCard) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedCard]);

  const closeModal = () => {
    setSelectedPoint(null);
    setSelectedCard(null);
  };

  return (
    <main className="bg-white pt-24">
      <section className="relative overflow-hidden bg-[#f4f4f4] px-6 pb-20 pt-24 text-center md:pb-32">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <FadeIn className="relative mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="mb-8 inline-block rounded-full border border-[#d1d1d1] bg-white px-4 py-1.5 text-sm font-medium text-[#1a1a1a] shadow-sm">
            {content.hero.eyebrow}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }} className="mb-8 font-serif text-5xl leading-[1.05] tracking-tight text-[#1a1a1a] md:text-7xl lg:text-[5.5rem]">
            {content.hero.title}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }} className="mx-auto max-w-2xl text-lg leading-relaxed text-[#666666] md:text-xl">{content.hero.description}</motion.p>
        </FadeIn>
      </section>

      <section className="bg-[#f2f2f2] px-6 py-24 md:py-32">
        <div className="mx-auto max-w-7xl">
          <FadeIn className="mb-14 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-6 inline-block rounded-full border border-[#d1d1d1] bg-white px-4 py-1.5 text-sm font-medium text-[#1a1a1a]">
                {possibilityContent?.eyebrow}
              </div>
              <h2 className="max-w-4xl text-4xl leading-[1.02] tracking-[-0.05em] text-[#1a1a1a] md:text-6xl">
                {possibilityContent?.heading}
              </h2>
            </div>
            <p className="max-w-xl text-lg leading-relaxed text-[#666666]">{possibilityContent?.description}</p>
          </FadeIn>

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
            {(possibilityContent?.items || []).map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="overflow-hidden rounded-[24px] border border-[#e5e5e5] bg-white shadow-sm"
              >
                <div className="h-56 overflow-hidden bg-[#e5e5e5]">
                  <img src={item.img} alt={item.title} className="h-full w-full object-cover grayscale transition-all duration-700 hover:scale-105 hover:grayscale-0" />
                </div>
                <div className="p-8">
                  <h3 className="mb-4 text-2xl font-medium tracking-tight text-[#1a1a1a]">{item.title}</h3>
                  <p className="text-base leading-relaxed text-[#666666]">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-24 lg:grid-cols-2 xl:grid-cols-3 md:py-32">
        {content.cards.map((card, index) => (
          <motion.button
            key={card.title}
            type="button"
            onClick={() => setSelectedCard(card)}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.45, delay: index * 0.09, ease: [0.25, 0.1, 0.25, 1] }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="group flex flex-col overflow-hidden rounded-[24px] border border-[#e5e5e5] bg-white text-left shadow-sm transition-all duration-500 hover:border-[#d1d1d1] hover:shadow-xl"
          >
            <div className="h-64 overflow-hidden bg-[#f4f4f4]">
              <img
                src={`https://images.unsplash.com/photo-${index === 0 ? '1451187580459-43490279c0fa' : index === 1 ? '1504384308090-c894fdcc538d' : '1620712943543-bcc4688e7485'}?q=80&w=1200&auto=format&fit=crop`}
                alt={card.title}
                className="h-full w-full object-cover grayscale transition-all duration-700 ease-out group-hover:scale-105 group-hover:grayscale-0"
              />
            </div>
            <div className="flex flex-1 flex-col p-8">
              <h2 className="mb-4 text-3xl font-medium tracking-tight text-[#1a1a1a]">{card.title}</h2>
              <p className="mb-10 text-lg leading-relaxed text-[#666666]">{card.description}</p>
              <div className="mt-auto flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#1a1a1a]">
                Explore service
                <span>{'->'}</span>
              </div>
            </div>
          </motion.button>
        ))}
      </section>

      <AnimatePresence>
        {selectedCard ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] overflow-y-auto bg-black/35 px-4 py-6 backdrop-blur-sm md:px-8"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 36, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 360, mass: 0.8 }}
              className="relative mx-auto max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeModal}
                className="absolute right-4 top-4 z-10 rounded-full border border-[#d1d1d1] bg-white px-4 py-2 text-sm font-medium text-[#666666] transition-colors hover:border-[#1a1a1a] hover:text-[#1a1a1a]"
              >
                Close
              </button>

              <div className="border-b border-[#e5e5e5] bg-[#f4f4f4] px-6 pb-8 pt-16 md:px-8 md:pb-10">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-[#a3a3a3]">Services</p>
                <h3 className="mb-3 text-3xl font-medium tracking-tight text-[#1a1a1a] md:text-4xl">
                  {selectedPoint ? selectedPoint.title : selectedCard.title}
                </h3>
                <p className="max-w-3xl text-lg leading-relaxed text-[#666666]">
                  {selectedPoint ? selectedPoint.description : selectedCard.description}
                </p>
              </div>

              {!selectedPoint ? (
                <div className="grid gap-4 p-6 md:grid-cols-3 md:p-8">
                  {selectedCard.points.map((point) => (
                    <button
                      key={point.title}
                      type="button"
                      onClick={() => setSelectedPoint(point)}
                      className="rounded-[20px] border border-[#e5e5e5] bg-[#f4f4f4] p-5 text-left transition-all duration-300 hover:border-[#d1d1d1] hover:shadow-md"
                    >
                      <h4 className="mb-2 text-lg font-medium text-[#1a1a1a]">{point.title}</h4>
                      <p className="leading-relaxed text-[#666666]">{point.description}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 md:p-8">
                  <div className="rounded-[24px] border border-[#e5e5e5] bg-[#f4f4f4] p-6 md:p-8">
                    <p className="text-lg leading-relaxed text-[#4a4a4a]">{selectedPoint.description}</p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'modal', target: 'sales' })}
                        className="rounded-full bg-[#1a1a1a] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
                      >
                        Talk to Sales
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPoint(null)}
                        className="rounded-full border border-[#d1d1d1] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#1a1a1a] transition-colors hover:border-[#1a1a1a]"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
};

export default PlatformPage;
