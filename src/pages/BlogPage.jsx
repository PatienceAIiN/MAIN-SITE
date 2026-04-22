import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const BlogPage = ({ content, onAction }) => {
  const navigate = useNavigate();
  const posts = content?.posts || [];

  return (
    <main className="bg-[#fbfaf7] pt-24">
      <section className="relative overflow-hidden border-b border-[#e3ddd1] bg-[#f4f1ea] px-6 pb-16 pt-24 text-center md:pb-24">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#171717 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="mb-8 inline-block rounded-full border border-[#d8d2c7] bg-white px-5 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#171717] shadow-sm">
            {content?.hero?.eyebrow}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }} className="mb-8 text-5xl font-medium leading-[0.92] tracking-[-0.06em] text-[#171717] md:text-7xl">
            {content?.hero?.title}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }} className="mx-auto max-w-3xl text-lg leading-relaxed text-[#5f5a52] md:text-xl">
            {content?.hero?.description}
          </motion.p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-20 md:grid-cols-2 xl:grid-cols-3 md:py-28">
        {posts.map((post, index) => (
          <motion.article
            key={post.slug}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.45, delay: (index % 3) * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
            className="group flex cursor-pointer flex-col overflow-hidden rounded-[30px] border border-[#e3ddd1] bg-white shadow-[0_18px_55px_rgba(23,23,23,0.05)] transition-all duration-500 hover:border-[#d2cbbb] hover:shadow-[0_28px_75px_rgba(23,23,23,0.10)]"
            onClick={() => navigate(`/company/blog/${post.slug}`)}
          >
            <div className="relative h-64 overflow-hidden bg-[#f4f1ea]">
              <img
                src={`https://images.unsplash.com/photo-${index % 3 === 0 ? '1516321497487-e288fb19713f' : index % 3 === 1 ? '1557200134-90327ee9fafa' : '1556742049-0cfed4f6a45d'}?q=80&w=1200&auto=format&fit=crop`}
                alt={post.title}
                className="h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#171717] shadow-sm">
                {post.header}
              </div>
            </div>

            <div className="flex flex-1 flex-col p-8">
              <p className="mb-3 text-sm font-medium text-[#5f5a52]">
                {post.by} · {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(post.publishedAt))}
              </p>
              <h2 className="mb-4 text-2xl font-medium tracking-[-0.04em] text-[#171717]">{post.title}</h2>
              <p className="mb-8 flex-1 leading-relaxed text-[#5f5a52]">{post.excerpt}</p>
              <div className="mb-8 flex flex-wrap gap-2">
                {(post.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#d8d2c7] bg-[#fbfaf7] px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#5f5a52]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#171717]">
                Read full story
                <span>{'->'}</span>
              </div>
            </div>
          </motion.article>
        ))}
      </section>

      <section className="border-t border-[#e3ddd1] bg-[#f4f1ea] px-6 py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-[30px] border border-[#d8d2c7] bg-white px-7 py-8 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6f6b63]">Need something specific?</p>
            <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em] text-[#171717]">Talk to the team behind the work.</h2>
          </div>
          <button
            type="button"
            onClick={() => onAction({ type: 'route', to: '/contact' })}
            className="rounded-full bg-[#171717] px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white"
          >
            Contact Us
          </button>
        </div>
      </section>
    </main>
  );
};

export default BlogPage;
