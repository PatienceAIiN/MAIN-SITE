import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';

const DetailPage = ({ pageContent, onAction }) => {
  const location = useLocation();
  if (!pageContent) {
    return <Navigate to="/products" replace />;
  }

  return (
    <main className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 px-6 py-20 md:px-10 lg:px-16 lg:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.18),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.1),_transparent_35%)]" />
        <div className="relative max-w-5xl mx-auto">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500 mb-6">{pageContent.groupTitle}</p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[0.95] mb-6">
            {pageContent.title}
          </h1>
          <p className="max-w-3xl text-lg text-slate-600 leading-relaxed mb-10">{pageContent.description}</p>
          <div className="flex flex-col sm:flex-row gap-4">
            {pageContent.cta && (
              <Button
                variant={pageContent.cta.variant}
                className="w-full sm:w-auto rounded-2xl px-8 py-4"
                onClick={() => onAction(pageContent.cta.action)}
              >
                {pageContent.cta.label}
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-10 lg:px-16">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8 md:p-10 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <span className="px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-[0.25em]">
                {pageContent.groupTitle}
              </span>
              <span className="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-[0.25em]">
                {location.pathname}
              </span>
            </div>

            <div className="space-y-4">
              {pageContent.points.map((point) => (
                <div key={point} className="flex items-start gap-4 rounded-2xl bg-white border border-slate-100 px-5 py-4">
                  <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0" />
                  <p className="text-slate-700 leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default DetailPage;
