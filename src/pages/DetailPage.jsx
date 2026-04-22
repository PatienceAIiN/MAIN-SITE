import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const DetailPage = ({ pageContent, onAction }) => {
  const location = useLocation();

  if (!pageContent) {
    return <Navigate to="/products" replace />;
  }

  return (
    <main className="bg-[#fbfaf7] pt-24">
      <section className="relative overflow-hidden border-b border-[#e3ddd1] bg-[#f4f1ea] px-6 pb-20 pt-24 md:pb-28">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#171717 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative mx-auto max-w-5xl">
          <p className="mb-6 text-sm font-semibold uppercase tracking-[0.35em] text-[#6f6b63]">{pageContent.groupTitle}</p>
          <h1 className="mb-6 text-5xl font-medium leading-[0.92] tracking-[-0.06em] text-[#171717] md:text-7xl">
            {pageContent.title}
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-[#5f5a52] md:text-xl">{pageContent.description}</p>

          {pageContent.cta ? (
            <button
              type="button"
              onClick={() => onAction(pageContent.cta.action)}
              className="mt-10 rounded-full bg-[#171717] px-8 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
            >
              {pageContent.cta.label}
            </button>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <div className="rounded-[30px] border border-[#e3ddd1] bg-white p-8 shadow-[0_18px_55px_rgba(23,23,23,0.05)] md:p-10">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#d8d2c7] bg-[#fbfaf7] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#171717]">
              {pageContent.groupTitle}
            </span>
            <span className="rounded-full border border-[#d8d2c7] bg-[#fbfaf7] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#5f5a52]">
              {location.pathname}
            </span>
          </div>

          <div className="space-y-4">
            {pageContent.points.map((point) => (
              <div key={point} className="flex items-start gap-4 rounded-2xl border border-[#e3ddd1] bg-[#fbfaf7] px-5 py-4">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#171717]" />
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
