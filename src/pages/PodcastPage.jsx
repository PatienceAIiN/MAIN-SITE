import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHero from '../components/PageHero';
import { useGlobalAudio } from '../components/GlobalAudioPlayer';

const EPISODES = [
  {
    slug: 'about-patience-ai',
    episode: 'EP 01',
    title: 'Automating Indian Business Operations with Patience AI',
    show: 'About Patience AI',
    excerpt: 'An inside look at how Patience AI is automating end-to-end business operations across Indian enterprises — and what that means for the future of work.',
    tags: ['Patience AI', 'Automation', 'India'],
    coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop',
    keyEn: 'podcast/Automating_Indian_business_operations_with_Patience_AI.m4a',
    keyHi: 'podcast/Automating_Indian_business_operations_with_Patience_AI_hi.m4a'
  },
  {
    slug: 'pariksha-ki-taiyari',
    episode: 'EP 02',
    title: 'Conquering the UPSC Syllabus with PKT',
    show: 'Pariksha Ki Taiyari',
    excerpt: 'A deep dive into how Pariksha Ki Taiyari is helping UPSC aspirants conquer one of the world\'s toughest syllabi with structured, AI-assisted preparation.',
    tags: ['Pariksha Ki Taiyari', 'UPSC', 'EdTech'],
    coverImage: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=1200&auto=format&fit=crop',
    keyEn: 'podcast/Conquering_the_UPSC_syllabus_with_PKT.m4a',
    keyHi: 'podcast/Conquering_the_UPSC_syllabus_with_PKT_hi.m4a'
  },
  {
    slug: 'nexus-exchange',
    episode: 'EP 03',
    title: 'Hacking B2B Trust with AI',
    show: 'Nexus Exchange',
    excerpt: 'How AI agents are rewriting the rules of B2B trust — from procurement to platform partnerships, and why the next decade belongs to networks that learn.',
    tags: ['Nexus Exchange', 'B2B', 'AI Agents'],
    coverImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop',
    keyEn: 'podcast/Hacking_B2B_trust_with_AI_video.m4a',
    keyHi: 'podcast/Hacking_B2B_trust_with_AI_video_hi.m4a'
  }
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PodcastPage = ({ content, siteContent }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialView = searchParams.get('tab') === 'blog' ? 'blog' : 'product';
  const blogPosts = siteContent?.blogPage?.posts || content?.blogPosts || [];
  const [blogLang, setBlogLang] = useState({});
  const [blogLoading, setBlogLoading] = useState(null);
  const [view, setView] = useState(initialView);
  const hero = content?.hero || {
    eyebrow: 'Patience AI Podcast',
    title: 'Conversations on the future of intelligent work.',
    description: 'Three shows. One mission: unpacking how AI is reshaping trust, learning, and operations across India and beyond.'
  };
  const globalAudio = useGlobalAudio();
  const [loadingId, setLoadingId] = useState(null);
  const [selectedLang, setSelectedLang] = useState({});

  const getLang = (slug) => selectedLang[slug] || 'en';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const playFromKey = async (key, ep, lang) => {
    const res = await fetch(`/api/podcast-url?key=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error('Failed to load episode');
    const { url } = await res.json();
    globalAudio.play({
      src: url,
      title: `${ep.show} — ${ep.title} (${lang === 'hi' ? 'हिन्दी' : 'English'})`,
      key
    });
  };

  const handlePlay = async (ep) => {
    const lang = getLang(ep.slug);
    const id = `${ep.slug}-${lang}`;
    if (loadingId) return;
    setLoadingId(id);

    try {
      if (lang === 'en') {
        await playFromKey(ep.keyEn, ep, 'en');
        return;
      }

      // Hindi: ask translate endpoint; it either returns ready URL or starts a job
      let attempts = 0;
      while (attempts < 60) {
        const res = await fetch(`/api/podcast-translate?key=${encodeURIComponent(ep.keyEn)}`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (data.status === 'ready' && data.url) {
          globalAudio.play({
            src: data.url,
            title: `${ep.show} — ${ep.title} (हिन्दी)`,
            key: ep.keyHi
          });
          return;
        }
        if (data.status === 'failed') throw new Error(data.error || 'Translation failed');
        attempts += 1;
        await sleep(5000);
      }
      throw new Error('Hindi generation is taking longer than expected. Please try again in a minute.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Unable to load this episode right now. Please try again.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <main className="bg-white pt-24">
      <PageHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        description={hero.description}
        coverImage="https://images.unsplash.com/photo-1478737270239-2f02b77fc618?q=80&w=2000&auto=format&fit=crop"
        coverVideo="https://videos.pexels.com/video-files/3129957/3129957-sd_640_360_25fps.mp4"
      />

      <div className="mx-auto mt-10 flex w-fit max-w-full justify-center px-6">
        <div className="inline-flex rounded-full border border-[#e5e5e5] bg-white p-1 text-xs font-semibold shadow-sm">
          {[
            { id: 'product', label: 'Product Podcasts' },
            { id: 'blog', label: 'Blog Podcasts' }
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setView(opt.id)}
              className={`rounded-full px-5 py-2 uppercase tracking-[0.14em] transition-colors ${
                view === opt.id ? 'bg-[#1a1a1a] text-white' : 'text-[#666666] hover:text-[#1a1a1a]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'product' ? (
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-16 md:grid-cols-2 xl:grid-cols-3 md:py-20">
        {EPISODES.map((ep, index) => {
          const lang = getLang(ep.slug);
          const activeKey = lang === 'hi' ? ep.keyHi : ep.keyEn;
          const isLoading = loadingId === `${ep.slug}-${lang}`;
          const isCurrent = globalAudio.current && globalAudio.current.key === activeKey;
          return (
            <motion.article
              key={ep.slug}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: (index % 3) * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
              className="group flex flex-col overflow-hidden rounded-[24px] border border-[#e5e5e5] bg-white shadow-sm transition-all duration-500 hover:border-[#d1d1d1] hover:shadow-xl"
            >
              <div className="relative h-64 overflow-hidden bg-[#f4f4f4]">
                <img
                  src={ep.coverImage}
                  alt={ep.title}
                  className="h-full w-full object-cover grayscale transition-all duration-700 ease-out group-hover:scale-105 group-hover:grayscale-0"
                />
                <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#1a1a1a] shadow-sm">
                  {ep.episode}
                </div>
                <div className="absolute right-4 top-4 rounded-full bg-black/80 px-3 py-1 text-xs font-medium text-white shadow-sm">
                  {ep.show}
                </div>
              </div>

              <div className="flex flex-1 flex-col p-8">
                <h2 className="mb-4 text-2xl font-medium tracking-tight text-[#1a1a1a]">{ep.title}</h2>
                <p className="mb-6 flex-1 leading-relaxed text-[#666666]">{ep.excerpt}</p>
                <div className="mb-6 flex flex-wrap gap-2">
                  {ep.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#d1d1d1] bg-[#fdfdfd] px-3.5 py-1.5 text-[12px] font-medium text-[#666666]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mb-4 inline-flex rounded-full border border-[#e5e5e5] bg-[#fafafa] p-1 text-xs font-semibold">
                  {[
                    { id: 'en', label: 'English' },
                    { id: 'hi', label: 'हिन्दी' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedLang((s) => ({ ...s, [ep.slug]: opt.id }))}
                      className={`rounded-full px-3 py-1.5 transition-colors ${
                        lang === opt.id ? 'bg-[#1a1a1a] text-white' : 'text-[#666666] hover:text-[#1a1a1a]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handlePlay(ep)}
                  disabled={isLoading}
                  className="mt-auto flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#1a1a1a] hover:text-black disabled:opacity-50"
                >
                  {isLoading
                    ? lang === 'hi'
                      ? 'Generating Hindi…'
                      : 'Loading…'
                    : isCurrent
                      ? 'Playing now'
                      : `Play ${lang === 'hi' ? 'in Hindi' : 'in English'}`}
                  <span>{isCurrent ? '♪' : '→'}</span>
                </button>
              </div>
            </motion.article>
          );
        })}
      </section>
      ) : null}

      {view === 'blog' && blogPosts.length > 0 ? (
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-[#a3a3a3]">From the Blog</p>
              <h2 className="font-serif text-4xl tracking-tight text-[#1a1a1a] md:text-5xl">Every article, as a podcast.</h2>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {blogPosts.map((post) => {
                const lang = blogLang[post.slug] || 'en';
                const id = `${post.slug}-${lang}`;
                const isLoading = blogLoading === id;
                const key = `blog:${post.slug}:${lang}`;
                const isCurrent = globalAudio.current && globalAudio.current.key === key;

                const play = async () => {
                  if (blogLoading) return;
                  setBlogLoading(id);
                  try {
                    let attempts = 0;
                    while (attempts < 60) {
                      const res = await fetch(`/api/blog-podcast?slug=${encodeURIComponent(post.slug)}&lang=${lang}`, { method: 'POST' });
                      const data = await res.json().catch(() => ({}));
                      if (data.status === 'ready' && data.url) {
                        globalAudio.play({
                          src: data.url,
                          title: `${post.title} (${lang === 'hi' ? 'हिन्दी' : 'English'})`,
                          key
                        });
                        return;
                      }
                      if (data.status === 'failed') throw new Error(data.error || 'Generation failed');
                      attempts += 1;
                      await sleep(5000);
                    }
                    throw new Error('Taking longer than expected. Try again in a minute.');
                  } catch (e) {
                    alert(e.message || 'Unable to load podcast.');
                  } finally {
                    setBlogLoading(null);
                  }
                };

                return (
                  <motion.article
                    key={post.slug}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col rounded-[20px] border border-[#e5e5e5] bg-white p-6 shadow-sm transition-all hover:border-[#d1d1d1] hover:shadow-md"
                  >
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#a3a3a3]">{post.header}</p>
                    <h3
                      className="mb-3 cursor-pointer text-lg font-semibold leading-snug text-[#1a1a1a] hover:underline"
                      onClick={() => navigate(`/company/blog/${post.slug}`)}
                    >
                      {post.title}
                    </h3>
                    <p className="mb-5 flex-1 text-sm leading-relaxed text-[#666666] line-clamp-3">{post.excerpt}</p>

                    <div className="mb-4 inline-flex rounded-full border border-[#e5e5e5] bg-[#fafafa] p-1 text-xs font-semibold">
                      {[
                        { id: 'en', label: 'EN' },
                        { id: 'hi', label: 'हिन्दी' }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setBlogLang((s) => ({ ...s, [post.slug]: opt.id }))}
                          className={`rounded-full px-3 py-1 transition-colors ${
                            lang === opt.id ? 'bg-[#1a1a1a] text-white' : 'text-[#666666] hover:text-[#1a1a1a]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={play}
                      disabled={isLoading}
                      className="inline-flex items-center gap-2 self-start rounded-full bg-[#1a1a1a] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-black disabled:opacity-60"
                    >
                      {isLoading
                        ? lang === 'hi' ? 'Generating Hindi…' : 'Generating…'
                        : isCurrent
                          ? '♪ Playing now'
                          : '♪ Listen Podcast'}
                    </button>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
};

export default PodcastPage;
