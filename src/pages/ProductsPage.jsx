import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import { iconRegistry } from '../common/iconRegistry';

const ProductsPage = ({ content, onAction }) => {
  const products = content.products || [];
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    if (!selectedProduct) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedProduct]);

  return (
    <main className="bg-[#fbfaf7] pt-24">
      <section className="relative overflow-hidden border-b border-[#e3ddd1] bg-[#f4f1ea] px-6 pb-20 pt-20 text-center md:pb-24 md:pt-28">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(#171717 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8 inline-flex rounded-full border border-[#d8d2c7] bg-white px-5 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#171717] shadow-sm">
            {content.hero.eyebrow}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }} className="text-5xl font-medium leading-[0.92] tracking-[-0.06em] text-[#171717] md:text-7xl lg:text-[5.8rem]">
            {content.hero.title}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.16 }} className="mx-auto mt-7 max-w-3xl text-lg leading-relaxed text-[#5f5a52] md:text-xl">
            {content.hero.description}
          </motion.p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-20 lg:grid-cols-2 lg:gap-12 md:py-28">
        {products.map((product, index) => (
          <motion.button
            key={product.id}
            type="button"
            onClick={() => setSelectedProduct(product)}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.45, delay: index * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="group flex flex-col overflow-hidden rounded-[30px] border border-[#e3ddd1] bg-white text-left shadow-[0_18px_55px_rgba(23,23,23,0.05)] transition-all duration-500 hover:border-[#d2cbbb] hover:shadow-[0_28px_75px_rgba(23,23,23,0.10)]"
          >
            <div className="relative h-72 overflow-hidden bg-[#f4f1ea] md:h-80">
              <div className="absolute left-6 top-6 z-10 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#171717] shadow-lg">
                Product {index + 1}
              </div>
              <img
                src={`https://images.unsplash.com/photo-${index === 0 ? '1516321497487-e288fb19713f' : '1557200134-90327ee9fafa'}?q=80&w=1200&auto=format&fit=crop`}
                alt={product.name}
                className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105"
              />
            </div>

            <div className="flex flex-1 flex-col p-8 md:p-10">
              <h2 className="mb-4 text-3xl font-medium tracking-[-0.04em] text-[#171717]">{product.name}</h2>
              <p className="mb-6 text-lg leading-relaxed text-[#5f5a52]">{product.summary}</p>
              <div className="mb-10 flex flex-wrap gap-2.5">
                {product.technologies.slice(0, 5).map((technology) => (
                  <span
                    key={technology}
                    className="rounded-full border border-[#d8d2c7] bg-[#fbfaf7] px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#5f5a52] transition-colors group-hover:border-[#171717]"
                  >
                    {technology}
                  </span>
                ))}
              </div>
              <span className="mt-auto inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#171717]">
                View details
                <span>{'->'}</span>
              </span>
            </div>
          </motion.button>
        ))}
      </section>

      <AnimatePresence>
        {selectedProduct ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/25 px-4 backdrop-blur-sm md:px-8"
            style={{ paddingTop: 'clamp(0.9rem, 4vh, 2.5rem)', paddingBottom: 'clamp(0.9rem, 4vh, 2.5rem)' }}
            onClick={() => setSelectedProduct(null)}
          >
            <div className="flex min-h-full items-start justify-center">
              <motion.div
                initial={{ opacity: 0, y: 36, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ type: 'spring', damping: 28, stiffness: 360, mass: 0.8 }}
                className="relative mx-auto w-full max-w-[calc(100vw-1rem)] overflow-y-auto rounded-[32px] bg-white shadow-2xl md:max-h-[calc(100dvh-3rem)] md:max-w-5xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="absolute right-4 top-4 z-10">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    aria-label="Close modal"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                  >
                    <SafeIcon icon={iconRegistry.FiX} className="w-5 h-5" />
                  </button>
                </div>

                <div className="border-b border-[#e3ddd1] bg-[#f4f1ea] px-6 pb-8 pt-16 md:px-8 md:pb-10">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#6f6b63]">Product</p>
                  <h3 className="mb-3 text-3xl font-medium tracking-[-0.04em] text-[#171717] md:text-4xl">{selectedProduct.name}</h3>
                  <p className="max-w-3xl text-lg leading-relaxed text-[#5f5a52]">{selectedProduct.summary}</p>
                </div>

                <div className="grid gap-6 p-6 md:grid-cols-[1.15fr_0.85fr] md:p-8">
                  <div className="rounded-[24px] border border-[#e3ddd1] bg-[#fbfaf7] p-6 md:p-8">
                    <div className="mb-6 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#d8d2c7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#171717]">
                        {selectedProduct.audience}
                      </span>
                      <span className="rounded-full border border-[#d8d2c7] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#5f5a52]">
                        {selectedProduct.privacyTone}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {selectedProduct.benefits.map((benefit) => (
                        <div key={benefit} className="flex items-start gap-3 rounded-2xl border border-[#e3ddd1] bg-white px-5 py-4">
                          <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#171717]" />
                          <p className="leading-relaxed text-[#4a453e]">{benefit}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#e3ddd1] bg-white p-6 md:p-8">
                    <div className="mb-8">
                      <div className="mb-6 flex items-center gap-4">
                        <div className="h-px flex-1 bg-[#e3ddd1]" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f6b63]">Technologies</span>
                        <div className="h-px flex-1 bg-[#e3ddd1]" />
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {selectedProduct.technologies.map((technology) => (
                          <span
                            key={technology}
                            className="rounded-full border border-[#d8d2c7] px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#5f5a52]"
                          >
                            {technology}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          onAction({
                            type: 'modal',
                            target: 'product-demo',
                            product: selectedProduct,
                            back: true
                          })
                        }
                        className="rounded-full bg-[#171717] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
                      >
                        Request Demo
                      </button>
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'modal', target: 'sales', back: true })}
                        className="rounded-full border border-[#d8d2c7] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#171717] transition-colors hover:border-[#171717]"
                      >
                        Contact Sales
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
};

export default ProductsPage;
