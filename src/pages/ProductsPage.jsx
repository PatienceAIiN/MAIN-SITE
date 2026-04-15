import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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
    <main className="bg-white pt-24">
      <section className="relative overflow-hidden bg-[#f4f4f4] px-6 pb-24 pt-24 text-center">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="relative mx-auto max-w-4xl">
          <div className="mb-8 inline-block rounded-full border border-[#d1d1d1] bg-white px-4 py-1.5 text-sm font-medium text-[#1a1a1a] shadow-sm">
            {content.hero.eyebrow}
          </div>
          <h1 className="mb-8 font-serif text-5xl leading-[1.05] tracking-tight text-[#1a1a1a] md:text-7xl lg:text-[5.5rem]">
            {content.hero.title}
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-[#666666] md:text-xl">{content.hero.description}</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-24 lg:grid-cols-2 lg:gap-12 md:py-32">
        {products.map((product, index) => (
          <button
            key={product.id}
            type="button"
            onClick={() => setSelectedProduct(product)}
            className="group flex flex-col overflow-hidden rounded-[24px] border border-[#e5e5e5] bg-white text-left shadow-sm transition-all duration-500 hover:border-[#d1d1d1] hover:shadow-xl"
          >
            <div className="relative h-64 overflow-hidden bg-[#f4f4f4] md:h-80">
              <div className="absolute left-6 top-6 z-10 rounded-2xl bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a] shadow-lg">
                Product {index + 1}
              </div>
              <img
                src={`https://images.unsplash.com/photo-${index === 0 ? '1516321497487-e288fb19713f' : '1557200134-90327ee9fafa'}?q=80&w=1200&auto=format&fit=crop`}
                alt={product.name}
                className="h-full w-full object-cover grayscale transition-all duration-700 ease-out group-hover:scale-105 group-hover:grayscale-0"
              />
            </div>

            <div className="flex flex-1 flex-col p-8 md:p-10">
              <h2 className="mb-4 text-3xl font-medium tracking-tight text-[#1a1a1a]">{product.name}</h2>
              <p className="mb-6 text-lg leading-relaxed text-[#666666]">{product.summary}</p>
              <div className="mb-10 flex flex-wrap gap-2.5">
                {product.technologies.slice(0, 5).map((technology) => (
                  <span
                    key={technology}
                    className="rounded-full border border-[#d1d1d1] bg-[#fdfdfd] px-3.5 py-1.5 text-[12px] font-medium text-[#666666] transition-colors group-hover:border-[#a3a3a3]"
                  >
                    {technology}
                  </span>
                ))}
              </div>
              <span className="mt-auto inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#1a1a1a]">
                View details
                <span>→</span>
              </span>
            </div>
          </button>
        ))}
      </section>

      <AnimatePresence>
        {selectedProduct ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] overflow-y-auto bg-black/35 px-4 py-6 backdrop-blur-sm md:px-8"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="relative mx-auto max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="absolute right-4 top-4 z-10 rounded-full border border-[#d1d1d1] bg-white px-4 py-2 text-sm font-medium text-[#666666] transition-colors hover:border-[#1a1a1a] hover:text-[#1a1a1a]"
              >
                Close
              </button>

              <div className="border-b border-[#e5e5e5] bg-[#f4f4f4] px-6 pb-8 pt-16 md:px-8 md:pb-10">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-[#a3a3a3]">Product</p>
                <h3 className="mb-3 text-3xl font-medium tracking-tight text-[#1a1a1a] md:text-4xl">{selectedProduct.name}</h3>
                <p className="max-w-3xl text-lg leading-relaxed text-[#666666]">{selectedProduct.summary}</p>
              </div>

              <div className="grid gap-6 p-6 md:grid-cols-[1.15fr_0.85fr] md:p-8">
                <div className="rounded-[24px] border border-[#e5e5e5] bg-[#f4f4f4] p-6 md:p-8">
                  <div className="mb-6 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#d1d1d1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#1a1a1a]">
                      {selectedProduct.audience}
                    </span>
                    <span className="rounded-full border border-[#d1d1d1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#666666]">
                      {selectedProduct.privacyTone}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedProduct.benefits.map((benefit) => (
                      <div key={benefit} className="flex items-start gap-3 rounded-2xl border border-[#e5e5e5] bg-white px-5 py-4">
                        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#1a1a1a]" />
                        <p className="leading-relaxed text-[#4a4a4a]">{benefit}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#e5e5e5] bg-white p-6 md:p-8">
                  <div className="mb-8">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="h-px flex-1 bg-[#e5e5e5]" />
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a3a3a3]">Technologies</span>
                      <div className="h-px flex-1 bg-[#e5e5e5]" />
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {selectedProduct.technologies.map((technology) => (
                        <span
                          key={technology}
                          className="rounded-full border border-[#d1d1d1] px-3.5 py-1.5 text-[12px] font-medium text-[#666666]"
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
                      className="rounded-full bg-[#1a1a1a] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
                    >
                      Request Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'modal', target: 'sales', back: true })}
                      className="rounded-full border border-[#d1d1d1] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#1a1a1a] transition-colors hover:border-[#1a1a1a]"
                    >
                      Contact Sales
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
};

export default ProductsPage;
