import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import { iconRegistry } from '../common/iconRegistry';
import MediaPlayer from '../components/MediaPlayer';
import ProductShowcase from '../components/ProductShowcase';
import FinalCTA from '../components/FinalCTA';

const Product = ({ siteContent, onAction }) => {
  const hero = siteContent?.productsPage?.hero;
  const products = siteContent?.productsPage?.products;
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    const productId = new URLSearchParams(location.search).get('product');
    if (!productId) return;
    const match = (products || []).find((product) => product.id === productId);
    if (match) setSelectedProduct(match);
    // consume the param so polling refreshes / closing the modal don't reopen it
    navigate(location.pathname, { replace: true });
  }, [location.key, location.search, location.pathname, products, navigate]);

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
    <div className="flex w-full flex-col">
      <div className="relative flex items-center justify-center overflow-hidden bg-[#1a1a1a] px-6 pb-32 pt-48 text-center">
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            muted
            playsInline
            loop
            preload="metadata"
            className="h-full w-full object-cover"
          >
            <source src="https://videos.pexels.com/video-files/2887463/2887463-sd_640_360_25fps.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/55 pointer-events-none" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="mb-8 inline-block rounded-full border border-white/25 bg-black/40 px-5 py-2 text-sm font-medium text-white backdrop-blur-sm animate-fade-rise">
            {hero?.eyebrow || 'Core Engines'}
          </div>
          <h1 className="mb-8 text-5xl font-serif leading-[1.05] tracking-tight text-white animate-fade-rise-delay md:text-7xl lg:text-[5.5rem]">
            {hero?.title || 'Our Products'}
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-white/80 animate-fade-rise-delay-2 md:text-xl">
            {hero?.description || 'Discover the suite of tools designed to elevate your infrastructure. Built for performance, designed for elegance, and ready to scale.'}
          </p>
        </div>
      </div>

      <ProductShowcase products={products} onSelect={setSelectedProduct} />
      <FinalCTA />

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
            <div className="min-h-full flex items-start justify-center">
              <motion.div
                initial={{ opacity: 0, y: 36, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ type: 'spring', damping: 28, stiffness: 360, mass: 0.8 }}
                className="relative mx-auto w-full max-w-[calc(100vw-1rem)] md:max-w-5xl overflow-y-auto max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-3rem)] rounded-[28px] bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="absolute right-4 top-4 z-10">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    aria-label="Close modal"
                    className="shrink-0 w-11 h-11 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors flex items-center justify-center"
                  >
                    <SafeIcon icon={iconRegistry.FiX} className="w-5 h-5" />
                  </button>
                </div>

              <div className="border-b border-[#e5e5e5] bg-[#f4f4f4] px-6 pb-8 pt-16 md:px-8 md:pb-10">
                <div className="mb-3 flex items-center gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#a3a3a3]">Product</p>
                  {selectedProduct.isNew ? (
                    <span className="inline-flex items-center rounded-full bg-[#1a1a1a] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                      New
                    </span>
                  ) : null}
                </div>
                <h3 className="mb-3 text-3xl font-medium tracking-tight text-[#1a1a1a] md:text-4xl">{selectedProduct.name}</h3>
                <p className="max-w-3xl text-lg leading-relaxed text-[#666666]">{selectedProduct.summary}</p>
              </div>

              {selectedProduct.media && selectedProduct.media.length > 0 ? (
                <div className="border-b border-[#e5e5e5] bg-white px-6 py-8 md:px-8">
                  <p className="mb-5 text-center text-xs font-bold uppercase tracking-[0.3em] text-[#a3a3a3]">Watch</p>
                  <div
                    className={
                      selectedProduct.media.length === 1
                        ? 'mx-auto w-full max-w-2xl'
                        : 'grid gap-5 md:grid-cols-2'
                    }
                  >
                    {selectedProduct.media.map((item) => (
                      <MediaPlayer key={item.src} type={item.type} title={item.title} src={item.src} />
                    ))}
                  </div>
                </div>
              ) : null}

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
                    {(selectedProduct.benefits || []).map((benefit) => (
                      <div key={benefit} className="flex items-start gap-3 rounded-2xl border border-[#e5e5e5] bg-white px-5 py-4">
                        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#1a1a1a]" />
                        <p className="leading-relaxed text-[#4a4a4a]">{benefit}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#e5e5e5] bg-white p-6 md:p-8">
                  <div className="flex flex-col gap-3">
                    {selectedProduct.demoUrl ? (
                      <a
                        href={selectedProduct.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-[#1a1a1a] px-6 py-4 text-center text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
                      >
                        Try Live Demo
                      </a>
                    ) : (
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
                    )}
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
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default Product;
