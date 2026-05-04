import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const DetailPage = ({ pageContent, onAction }) => {
  const location = useLocation();

  if (!pageContent) {
    return <Navigate to="/products" replace />;
  }

  return (
    <main className="bg-white pt-24">
      <section className="relative overflow-hidden bg-[#f4f4f4] px-6 pb-20 pt-24 md:pb-28">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="relative mx-auto max-w-5xl">
          <p className="mb-6 text-sm font-medium uppercase tracking-[0.35em] text-[#666666]">{pageContent.groupTitle}</p>
          <h1 className="mb-6 font-serif text-5xl leading-[1.05] tracking-tight text-[#1a1a1a] md:text-7xl">
            {pageContent.title}
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-[#666666] md:text-xl">{pageContent.description}</p>

          {pageContent.cta ? (
            <button
              type="button"
              onClick={() => onAction(pageContent.cta.action)}
              className="mt-10 rounded-full bg-[#1a1a1a] px-8 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
            >
              {pageContent.cta.label}
            </button>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
        <div className="rounded-[24px] border border-[#e5e5e5] bg-[#f4f4f4] p-8 shadow-sm md:p-10">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#d1d1d1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#1a1a1a]">
              {pageContent.groupTitle}
            </span>
            <span className="rounded-full border border-[#d1d1d1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#666666]">
              {location.pathname}
            </span>
          </div>

          <div className="space-y-4">
            {pageContent.points.map((point) => (
              <div key={point} className="flex items-start gap-4 rounded-2xl border border-[#e5e5e5] bg-white px-5 py-4">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#1a1a1a]" />
                <p className="leading-relaxed text-[#4a4a4a]">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default DetailPage;
