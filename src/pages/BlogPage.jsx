import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../components/ui/Button';

const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    : 'Unknown';

const BlogPage = ({ content, onAction }) => {
  const navigate = useNavigate();
  const posts = content?.posts || [];

  return (
    <main className="bg-white">
      <section className="relative overflow-hidden bg-[#0f172a] text-white px-6 py-16 md:px-10 lg:px-16 lg:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.28),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.14),_transparent_35%)]" />
        <div className="relative max-w-6xl mx-auto">
          <p className="text-xs md:text-sm uppercase tracking-[0.35em] text-white/55 mb-5">{content?.hero?.eyebrow}</p>
          <h1 className="max-w-4xl text-4xl md:text-6xl font-semibold tracking-tight leading-[0.96] mb-5">
            {content?.hero?.title}
          </h1>
          <p className="max-w-3xl text-base md:text-lg text-slate-300 leading-relaxed">
            {content?.hero?.description}
          </p>
        </div>
      </section>

      <section className="px-6 py-14 md:px-10 lg:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-10">
            {posts.length ? (
              posts.map((post, index) => (
                <motion.article
                  key={post.slug}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ delay: index * 0.06 }}
                  className="group rounded-[2rem] border border-slate-200 bg-slate-50 overflow-hidden shadow-sm"
                >
                  <div className="grid gap-0 lg:grid-cols-[1.12fr_0.88fr]">
                    <div className="p-7 md:p-10">
                      <div className="flex flex-wrap items-center gap-3 mb-5">
                        <span className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold uppercase tracking-[0.25em]">
                          {post.header}
                        </span>
                        <span className="text-sm text-slate-500">{formatDateTime(post.publishedAt)}</span>
                        <span className="text-sm text-slate-400">by {post.by}</span>
                      </div>

                      <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 leading-tight mb-4">
                        {post.title}
                      </h2>

                      <p className="text-slate-600 text-lg leading-relaxed mb-8 max-w-3xl">{post.excerpt}</p>

                      <div className="flex flex-wrap gap-2 mb-8">
                        {(post.tags || []).map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-500 text-xs font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <Button
                        variant="secondary"
                        className="rounded-2xl px-6 py-3.5"
                        onClick={() => navigate(`/company/blog/${post.slug}`)}
                      >
                        Read article
                      </Button>
                    </div>

                    <div className="bg-[#0f172a] text-white p-7 md:p-10 flex items-end min-h-[220px] lg:min-h-full">
                      <div className="w-full rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/45 mb-3">Author</p>
                        <p className="text-2xl font-semibold mb-5">{post.by}</p>
                        <div className="space-y-3 text-white/65 text-sm leading-relaxed">
                          {(post.content || []).slice(0, 2).map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))
            ) : (
              <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-10 text-slate-600">
                No posts published yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default BlogPage;
