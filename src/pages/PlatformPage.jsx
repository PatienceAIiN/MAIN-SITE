import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Button from '../components/ui/Button';
import SafeIcon from '../common/SafeIcon';
import { iconRegistry } from '../common/iconRegistry';

const PlatformPage = ({ content, onAction }) => {
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

  const goBack = () => {
    if (selectedPoint) {
      setSelectedPoint(null);
      return;
    }

    closeModal();
  };

  return (
    <main className="bg-white">
      <section className="relative overflow-hidden bg-[#0f172a] text-white px-6 py-14 md:px-10 lg:px-16 lg:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.28),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.16),_transparent_35%)]" />
        <div className="relative max-w-7xl mx-auto">
          <p className="text-xs md:text-sm uppercase tracking-[0.35em] text-white/60 mb-5">{content.hero.eyebrow}</p>
          <h1 className="max-w-4xl text-4xl md:text-6xl font-semibold tracking-tight leading-[0.95] mb-5">
            {content.hero.title}
          </h1>
          <p className="max-w-3xl text-base md:text-lg text-slate-300 leading-relaxed">
            {content.hero.description}
          </p>
        </div>
      </section>

      <section className="px-6 py-10 md:px-10 lg:px-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {content.cards.map((card, index) => (
            <motion.button
              key={card.title}
              type="button"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: index * 0.06 }}
              onClick={() => setSelectedCard(card)}
              className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 md:p-7 text-left shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-4">Platform</p>
              <h2 className="text-2xl font-semibold text-slate-900 mb-3">{card.title}</h2>
              <p className="text-slate-600 leading-relaxed">{card.description}</p>
            </motion.button>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {selectedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-slate-950/70 backdrop-blur-sm px-4 py-6 md:px-8 overflow-y-auto"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative max-w-4xl mx-auto rounded-[2rem] bg-white shadow-2xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeModal}
                className="absolute top-4 right-4 z-20 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
              >
                Cancel
              </button>

              <motion.button
                type="button"
                onClick={goBack}
                whileHover={{ x: -2 }}
                whileTap={{ scale: 0.96 }}
                aria-label="Back"
                className="absolute top-4 left-4 z-20 w-11 h-11 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors flex items-center justify-center"
              >
                <SafeIcon icon={iconRegistry.FiArrowLeft} className="w-5 h-5" />
              </motion.button>

              <div className="px-6 pt-16 pb-6 md:px-8 md:pt-16 md:pb-8 border-b border-slate-100">
                <p className="text-xs uppercase tracking-[0.35em] text-indigo-500 mb-3">Platform</p>
                <h3 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 mb-3">
                  {selectedPoint ? selectedPoint.title : selectedCard.title}
                </h3>
                <p className="max-w-3xl text-slate-600 leading-relaxed">
                  {selectedPoint ? selectedPoint.description : selectedCard.description}
                </p>
              </div>

              {!selectedPoint ? (
                <div className="p-6 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {selectedCard.points.map((point) => (
                      <button
                        key={point.title}
                        type="button"
                        onClick={() => setSelectedPoint(point)}
                        className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 text-left hover:border-indigo-300 hover:shadow-md transition-all"
                      >
                        <h4 className="text-lg font-semibold text-slate-900 mb-2">{point.title}</h4>
                        <p className="text-slate-600 leading-relaxed">{point.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 md:p-8">
                  <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 md:p-8">
                    <div className="space-y-4">
                      <div className="rounded-2xl bg-white border border-slate-100 px-5 py-4">
                        <p className="text-sm uppercase tracking-[0.25em] text-slate-400 mb-2">What it means</p>
                        <p className="text-slate-700 leading-relaxed">{selectedPoint.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          variant="purple"
                          className="rounded-2xl px-6 py-3.5"
                          onClick={() => onAction({ type: 'modal', target: 'sales' })}
                        >
                          Talk to Sales
                        </Button>
                        <Button
                          variant="secondary"
                          className="rounded-2xl px-6 py-3.5"
                          onClick={() => onAction({ type: 'route', to: '/products' })}
                        >
                          View products
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};

export default PlatformPage;
