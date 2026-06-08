import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import MediaPlayer from '../components/MediaPlayer';
import PageHero from '../components/PageHero';

const COVER_BY_PATH = {
  '/company/about-us': 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?q=80&w=2000&auto=format&fit=crop',
  '/docs': 'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?q=80&w=2000&auto=format&fit=crop',
  '/product/features': 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2000&auto=format&fit=crop',
  '/product/integrations': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2000&auto=format&fit=crop',
  '/product/pricing': 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?q=80&w=2000&auto=format&fit=crop',
  '/product/changelog': 'https://images.unsplash.com/photo-1542435503-956c469947f6?q=80&w=2000&auto=format&fit=crop'
};
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2000&auto=format&fit=crop';

const VIDEO_TECH = 'https://videos.pexels.com/video-files/2887463/2887463-sd_640_360_25fps.mp4';
const VIDEO_NETWORK = 'https://videos.pexels.com/video-files/3209828/3209828-sd_640_360_25fps.mp4';
const VIDEO_ABSTRACT = 'https://videos.pexels.com/video-files/3129957/3129957-sd_640_360_25fps.mp4';

const VIDEO_BY_PATH = {
  '/company/about-us': VIDEO_ABSTRACT,
  '/docs': VIDEO_ABSTRACT,
  '/product/features': VIDEO_TECH,
  '/product/integrations': VIDEO_NETWORK,
  '/product/pricing': VIDEO_ABSTRACT,
  '/product/changelog': VIDEO_TECH
};

const DetailPage = ({ pageContent, onAction }) => {
  const location = useLocation();

  if (!pageContent) {
    return <Navigate to="/products" replace />;
  }

  return (
    <main className="bg-white pt-24">
      <PageHero
        eyebrow={pageContent.groupTitle}
        title={pageContent.title}
        description={pageContent.description}
        coverImage={COVER_BY_PATH[location.pathname] || DEFAULT_COVER}
        coverVideo={VIDEO_BY_PATH[location.pathname] || VIDEO_ABSTRACT}
      >
        {pageContent.cta ? (
          <button
            type="button"
            onClick={() => onAction(pageContent.cta.action)}
            className="rounded-full bg-white px-8 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#1a1a1a] transition-colors hover:bg-transparent hover:text-white hover:ring-1 hover:ring-white"
          >
            {pageContent.cta.label}
          </button>
        ) : null}
      </PageHero>

      {pageContent.media && pageContent.media.length > 0 ? (
        <section className="mx-auto max-w-3xl px-6 pt-16 md:pt-20">
          <div className={pageContent.media.length === 1 ? 'mx-auto w-full' : 'grid gap-6 md:grid-cols-2'}>
            {pageContent.media.map((item) => (
              <MediaPlayer key={item.src} type={item.type} title={item.title} src={item.src} />
            ))}
          </div>
        </section>
      ) : null}

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
