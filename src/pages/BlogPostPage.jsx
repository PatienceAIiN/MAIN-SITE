import React, { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import MediaPlayer from '../components/MediaPlayer';
import { useGlobalAudio } from '../components/GlobalAudioPlayer';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BlogPostPage = ({ content, onAction }) => {
  const { slug } = useParams();
  const post = content?.posts?.find((item) => item.slug === slug);
  const globalAudio = useGlobalAudio();
  const [podLang, setPodLang] = useState('en');
  const [podLoading, setPodLoading] = useState(false);

  const handleListenPodcast = async () => {
    if (podLoading || !post) return;
    setPodLoading(true);
    try {
      let attempts = 0;
      while (attempts < 60) {
        const res = await fetch(`/api/blog-podcast?slug=${encodeURIComponent(post.slug)}&lang=${podLang}`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (data.status === 'ready' && data.url) {
          globalAudio.play({
            src: data.url,
            title: `${post.title} (${podLang === 'hi' ? 'हिन्दी' : 'English'})`,
            key: `blog:${post.slug}:${podLang}`
          });
          return;
        }
        if (data.status === 'failed') throw new Error(data.error || 'Generation failed');
        attempts += 1;
        await sleep(5000);
      }
      throw new Error('Audio generation is taking longer than expected. Please try again in a minute.');
    } catch (e) {
      alert(e.message || 'Unable to load podcast for this blog right now.');
    } finally {
      setPodLoading(false);
    }
  };

  if (!post) {
    return <Navigate to="/company/blog" replace />;
  }

  return (
    <main className="bg-white pt-24">
      <section className="relative overflow-hidden border-b border-[#e5e5e5] bg-[#f4f4f4] px-6 pb-20 pt-16">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="relative mx-auto max-w-4xl">
          <div className="mb-8 flex flex-wrap items-center gap-4">
            <span className="rounded-full border border-[#d1d1d1] bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#1a1a1a]">
              {post.header}
            </span>
            <span className="text-sm font-medium text-[#666666]">by {post.by}</span>
            <span className="text-sm font-medium text-[#666666]">
              {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.publishedAt))}
            </span>
          </div>
          <h1 className="text-4xl font-medium leading-[1.08] tracking-tight text-[#1a1a1a] md:text-5xl lg:text-6xl">
            {post.title}
          </h1>

          <div className="mt-8 inline-flex flex-wrap items-center gap-3 rounded-full border border-[#d1d1d1] bg-white px-2 py-1 shadow-sm">
            <span className="px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3a3a3]">Listen</span>
            <div className="inline-flex rounded-full bg-[#f4f4f4] p-0.5 text-[11px] font-semibold">
              {[
                { id: 'en', label: 'EN' },
                { id: 'hi', label: 'हिन्दी' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPodLang(opt.id)}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    podLang === opt.id ? 'bg-[#1a1a1a] text-white' : 'text-[#666666] hover:text-[#1a1a1a]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleListenPodcast}
              disabled={podLoading}
              className="inline-flex items-center gap-2 rounded-full bg-[#1a1a1a] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-black disabled:opacity-60"
            >
              {podLoading ? 'Preparing…' : '♪ Listen Podcast'}
            </button>
          </div>
        </div>
      </section>

      <div className="relative mx-auto -mt-12 max-w-5xl px-6">
        <div className="aspect-[21/9] overflow-hidden rounded-[24px] bg-[#e5e5e5] shadow-2xl">
          <img
            src={post.coverImage || 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=1800&auto=format&fit=crop'}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-6 py-24">
        <p className="mb-16 text-xl font-medium leading-relaxed text-[#666666] md:text-2xl">{post.excerpt}</p>
        {(post.content || []).map((paragraph) => (
          <p key={paragraph} className="mb-8 text-lg leading-relaxed text-[#4a4a4a]">
            {paragraph}
          </p>
        ))}

        {post.media && post.media.length > 0 ? (
          <div
            className={
              post.media.length === 1
                ? 'mt-12 mx-auto w-full max-w-2xl'
                : 'mt-12 grid gap-8 md:grid-cols-2'
            }
          >
            {post.media.map((item) => (
              <MediaPlayer key={item.src} type={item.type} title={item.title} src={item.src} />
            ))}
          </div>
        ) : null}

        <div className="mt-24 flex flex-col gap-8 border-t border-[#e5e5e5] pt-12 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="mb-2 text-2xl font-medium text-[#1a1a1a]">Ready to build something similar?</h3>
            <p className="text-[#666666]">Let&apos;s discuss the product, workflow, and rollout path.</p>
          </div>
          <button
            type="button"
            onClick={() => onAction({ type: 'modal', target: 'sales' })}
            className="w-fit rounded-[4px] bg-[#1a1a1a] px-8 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
          >
            Reach Out
          </button>
        </div>
      </article>
    </main>
  );
};

export default BlogPostPage;
