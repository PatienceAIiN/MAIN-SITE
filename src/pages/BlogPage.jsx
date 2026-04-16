import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import FadeIn from '../common/FadeIn';

const BlogPage = ({ content }) => {
  const navigate = useNavigate();
  const posts = content?.posts || [];

  return (
    <main className="bg-white pt-24">
      <section className="relative overflow-hidden bg-[#f4f4f4] px-6 pb-16 pt-24 text-center">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <FadeIn className="relative mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="mb-8 inline-block rounded-full border border-[#d1d1d1] bg-white px-4 py-1.5 text-sm font-medium text-[#1a1a1a] shadow-sm">
            {content?.hero?.eyebrow}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }} className="mb-8 font-serif text-5xl leading-[1.05] tracking-tight text-[#1a1a1a] md:text-7xl">
            {content?.hero?.title}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }} className="mx-auto max-w-2xl text-lg leading-relaxed text-[#666666] md:text-xl">{content?.hero?.description}</motion.p>
        </FadeIn>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-24 md:grid-cols-2 xl:grid-cols-3 md:py-32">
        {posts.map((post, index) => (
          <motion.article
            key={post.slug}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.45, delay: (index % 3) * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
            className="group flex cursor-pointer flex-col overflow-hidden rounded-[24px] border border-[#e5e5e5] bg-white shadow-sm transition-all duration-500 hover:border-[#d1d1d1] hover:shadow-xl"
            onClick={() => navigate(`/company/blog/${post.slug}`)}
          >
            <div className="relative h-64 overflow-hidden bg-[#f4f4f4]">
              <img
                src={`https://images.unsplash.com/photo-${index % 3 === 0 ? '1516321497487-e288fb19713f' : index % 3 === 1 ? '1557200134-90327ee9fafa' : '1556742049-0cfed4f6a45d'}?q=80&w=1200&auto=format&fit=crop`}
                alt={post.title}
                className="h-full w-full object-cover grayscale transition-all duration-700 ease-out group-hover:scale-105 group-hover:grayscale-0"
              />
              <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#1a1a1a] shadow-sm">
                {post.header}
              </div>
            </div>

            <div className="flex flex-1 flex-col p-8">
              <p className="mb-3 text-sm font-medium text-[#666666]">
                {post.by} · {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(post.publishedAt))}
              </p>
              <h2 className="mb-4 text-2xl font-medium tracking-tight text-[#1a1a1a]">{post.title}</h2>
              <p className="mb-8 flex-1 leading-relaxed text-[#666666]">{post.excerpt}</p>
              <div className="mb-8 flex flex-wrap gap-2">
                {(post.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#d1d1d1] bg-[#fdfdfd] px-3.5 py-1.5 text-[12px] font-medium text-[#666666]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#1a1a1a]">
                Read full story
                <span>→</span>
              </div>
            </div>
          </motion.article>
        ))}
      </section>
    </main>
  );
};

export default BlogPage;
