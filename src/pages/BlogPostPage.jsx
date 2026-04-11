import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';

const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    : 'Unknown';

const BlogPostPage = ({ content, onAction }) => {
  const { slug } = useParams();
  const post = content?.posts?.find((item) => item.slug === slug);

  if (!post) {
    return <Navigate to="/company/blog" replace />;
  }

  return (
    <main className="bg-white">
      <section className="relative overflow-hidden bg-[#0f172a] text-white px-6 py-16 md:px-10 lg:px-16 lg:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.28),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.14),_transparent_35%)]" />
        <div className="relative max-w-5xl mx-auto">
          <p className="text-xs md:text-sm uppercase tracking-[0.35em] text-white/55 mb-5">{post.header}</p>
          <h1 className="max-w-4xl text-4xl md:text-6xl font-semibold tracking-tight leading-[0.96] mb-6">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span>by {post.by}</span>
            <span className="text-white/30">•</span>
            <span>{formatDateTime(post.publishedAt)}</span>
          </div>
        </div>
      </section>

      <section className="px-6 py-14 md:px-10 lg:px-16">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-7 md:p-10 shadow-sm">
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

            <div className="space-y-6 text-slate-700 leading-relaxed text-lg">
              {(post.content || []).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 items-start">
              <Button
                variant="purple"
                className="rounded-2xl px-6 py-3.5"
                onClick={() => onAction({ type: 'modal', target: 'sales' })}
              >
                Talk to Sales
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default BlogPostPage;
