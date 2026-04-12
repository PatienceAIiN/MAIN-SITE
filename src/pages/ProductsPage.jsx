import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Button from '../components/ui/Button';

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

  const closeModal = () => {
    setSelectedProduct(null);
  };

  return (
    <main className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 px-6 py-14 md:px-10 lg:px-16 lg:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.12),_transparent_35%)]" />
        <motion.div
          aria-hidden="true"
          animate={{ x: [0, 18, 0], y: [0, -12, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute right-[-8%] top-[-10%] h-80 w-80"
        >
          <div className="h-full w-full rounded-full bg-indigo-200/45 blur-3xl" />
        </motion.div>
        <div className="relative max-w-7xl mx-auto">
          <p className="text-xs md:text-sm uppercase tracking-[0.35em] text-slate-500 mb-5">{content.hero.eyebrow}</p>
          <h1 className="max-w-4xl text-4xl md:text-6xl font-semibold tracking-tight leading-[0.95] mb-5">
            {content.hero.title}
          </h1>
          <p className="max-w-3xl text-base md:text-lg text-slate-600 leading-relaxed mb-8">
            {content.hero.description}
          </p>
          {content.hero.buttons?.length ? (
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {content.hero.buttons.map((button) => (
                <Button
                  key={button.label}
                  variant={button.variant}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl"
                  onClick={() => onAction(button.action)}
                >
                  {button.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="px-6 py-10 md:px-10 lg:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {products.map((product, productIndex) => (
              <motion.button
                key={product.id}
                type="button"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ delay: productIndex * 0.08 }}
                onClick={() => setSelectedProduct(product)}
                className="group rounded-[2rem] border border-slate-200 bg-slate-50 p-7 md:p-8 text-left shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
              >
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-[0.25em]">
                    Product
                  </span>
                  <span className="text-sm text-slate-500">{product.audience}</span>
                </div>

                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mb-3">
                  {product.name}
                </h2>
                <p className="text-slate-600 leading-relaxed mb-4">{product.shortTagline}</p>
                <p className="text-slate-700 leading-relaxed mb-6 line-clamp-3">{product.summary}</p>

                <div className="flex flex-wrap gap-2">
                  {product.technologies.slice(0, 3).map((technology) => (
                    <span
                      key={technology}
                      className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-500 text-xs font-medium"
                    >
                      {technology}
                    </span>
                  ))}
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[125] bg-slate-950/25 backdrop-blur-sm px-4 py-6 md:px-8 overflow-y-auto"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative max-w-5xl mx-auto rounded-[2rem] bg-white shadow-2xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeModal}
                className="absolute top-4 right-4 z-20 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
              >
                Cancel
              </button>

              <div className="px-6 pt-8 pb-6 md:px-8 md:pt-10 md:pb-8 border-b border-slate-100">
                <p className="text-xs uppercase tracking-[0.35em] text-indigo-500 mb-3">Product</p>
                <h3 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 mb-3">
                  {selectedProduct.name}
                </h3>
                <p className="max-w-3xl text-slate-600 leading-relaxed">
                  {selectedProduct.summary}
                </p>
              </div>

              <div className="p-6 md:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
                  <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 md:p-8">
                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-[0.25em]">
                        {selectedProduct.audience}
                      </span>
                      <span className="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-[0.25em]">
                        {selectedProduct.privacyTone}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {selectedProduct.benefits.slice(0, 4).map((benefit) => (
                        <div
                          key={benefit}
                          className="flex items-start gap-3 rounded-2xl bg-white border border-slate-100 px-5 py-4"
                        >
                          <span className="mt-2 h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0" />
                          <p className="text-slate-700 leading-relaxed">{benefit}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 md:p-8">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-4">Technology</p>
                    <div className="space-y-3 mb-8">
                      {selectedProduct.technologies.map((technology) => (
                        <div
                          key={technology}
                          className="rounded-2xl bg-white border border-slate-100 px-5 py-4 text-slate-700 leading-relaxed"
                        >
                          {technology}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3">
                      <Button
                        variant="coral"
                        className="rounded-2xl px-6 py-3.5"
                        onClick={() =>
                          onAction({
                            type: 'modal',
                            target: 'product-demo',
                            product: selectedProduct,
                            back: true
                          })
                        }
                      >
                        Request demo
                      </Button>
                      <Button
                        variant="secondary"
                        className="rounded-2xl px-6 py-3.5"
                        onClick={() => onAction({ type: 'modal', target: 'sales', back: true })}
                      >
                        Contact sales
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};

export default ProductsPage;
