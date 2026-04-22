import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import { iconRegistry } from '../common/iconRegistry';

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
    <main className="bg-[#fbfaf7] pt-24">
      <section className="relative overflow-hidden border-b border-[#e3ddd1] bg-[#f4f1ea] px-6 pb-20 pt-20 text-center md:pb-28 md:pt-28">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(#171717 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="mb-8 inline-block rounded-full border border-[#d8d2c7] bg-white px-5 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#171717] shadow-sm">
            {content.hero.eyebrow}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }} className="mb-8 text-5xl font-medium leading-[0.92] tracking-[-0.06em] text-[#171717] md:text-7xl lg:text-[5.8rem]">
            {content.hero.title}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }} className="mx-auto max-w-3xl text-lg leading-relaxed text-[#5f5a52] md:text-xl">
            {content.hero.description}
          </motion.p>
        </div>
      </section>

      <section className="bg-white px-6 py-20 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-6 inline-block rounded-full border border-[#d8d2c7] bg-[#fbfaf7] px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.24em] text-[#171717]">
                {possibilityContent?.eyebrow}
              </div>
              <h2 className="max-w-4xl text-4xl leading-[0.95] tracking-[-0.05em] text-[#171717] md:text-6xl">
                {possibilityContent?.heading}
              </h2>
            </div>
            <p className="max-w-xl text-lg leading-relaxed text-[#5f5a52]">{possibilityContent?.description}</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
            {(possibilityContent?.items || []).map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="overflow-hidden rounded-[28px] border border-[#e3ddd1] bg-[#fbfaf7] shadow-[0_18px_55px_rgba(23,23,23,0.05)]"
              >
                <div className="h-56 overflow-hidden bg-[#e5e5e5]">
                  <img src={item.img} alt={item.title} className="h-full w-full object-cover transition-all duration-700 hover:scale-105" />
                </div>
                <div className="p-8">
                  <h3 className="mb-4 text-2xl font-medium tracking-[-0.04em] text-[#171717]">{item.title}</h3>
                  <p className="text-base leading-relaxed text-[#5f5a52]">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-20 lg:grid-cols-2 xl:grid-cols-3 md:py-28">
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
            className="group flex flex-col overflow-hidden rounded-[30px] border border-[#e3ddd1] bg-white text-left shadow-[0_18px_55px_rgba(23,23,23,0.05)] transition-all duration-500 hover:border-[#d2cbbb] hover:shadow-[0_28px_75px_rgba(23,23,23,0.10)]"
          >
            <div className="h-64 overflow-hidden bg-[#f4f1ea]">
              <img
                src={`https://images.unsplash.com/photo-${index === 0 ? '1451187580459-43490279c0fa' : index === 1 ? '1504384308090-c894fdcc538d' : '1620712943543-bcc4688e7485'}?q=80&w=1200&auto=format&fit=crop`}
                alt={card.title}
                className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105"
              />
            </div>
            <div className="flex flex-1 flex-col p-8">
              <h2 className="mb-4 text-3xl font-medium tracking-[-0.04em] text-[#171717]">{card.title}</h2>
              <p className="mb-10 text-lg leading-relaxed text-[#5f5a52]">{card.description}</p>
              <div className="mt-auto flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#171717]">
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
            className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/25 px-4 backdrop-blur-sm md:px-8"
            style={{ paddingTop: 'clamp(0.9rem, 4vh, 2.5rem)', paddingBottom: 'clamp(0.9rem, 4vh, 2.5rem)' }}
            onClick={closeModal}
          >
            <div className="flex min-h-full items-start justify-center">
              <motion.div
                initial={{ opacity: 0, y: 36, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ type: 'spring', damping: 28, stiffness: 360, mass: 0.8 }}
                className="relative mx-auto max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[28px] bg-white shadow-2xl md:max-h-[calc(100dvh-3rem)] md:max-w-4xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="absolute right-4 top-4 z-10">
                  <button
                    type="button"
                    onClick={closeModal}
                    aria-label="Close modal"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                  >
                    <SafeIcon icon={iconRegistry.FiX} className="w-5 h-5" />
                  </button>
                </div>

                <div className="border-b border-[#e3ddd1] bg-[#f4f1ea] px-6 pb-8 pt-16 md:px-8 md:pb-10">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#6f6b63]">Services</p>
                  <h3 className="mb-3 text-3xl font-medium tracking-[-0.04em] text-[#171717] md:text-4xl">
                    {selectedPoint ? selectedPoint.title : selectedCard.title}
                  </h3>
                  <p className="max-w-3xl text-lg leading-relaxed text-[#5f5a52]">
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
                        className="rounded-[20px] border border-[#e3ddd1] bg-[#fbfaf7] p-5 text-left transition-all duration-300 hover:border-[#d2cbbb] hover:shadow-md"
                      >
                        <h4 className="mb-2 text-lg font-medium text-[#171717]">{point.title}</h4>
                        <p className="leading-relaxed text-[#5f5a52]">{point.description}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 md:p-8">
                    <div className="rounded-[24px] border border-[#e3ddd1] bg-[#fbfaf7] p-6 md:p-8">
                      <p className="text-lg leading-relaxed text-[#4a4a4a]">{selectedPoint.description}</p>
                      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => onAction({ type: 'modal', target: 'sales' })}
                          className="rounded-full bg-[#171717] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
                        >
                          Talk to Sales
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPoint(null)}
                          className="rounded-full border border-[#d8d2c7] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#171717] transition-colors hover:border-[#171717]"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
};

export default PlatformPage;
