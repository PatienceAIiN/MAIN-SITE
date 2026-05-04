import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

const BlogPostPage = ({ content, onAction }) => {
  const { slug } = useParams();
  const post = content?.posts?.find((item) => item.slug === slug);

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
        </div>
      </section>

      <div className="relative mx-auto -mt-12 max-w-5xl px-6">
        <div className="aspect-[21/9] overflow-hidden rounded-[24px] bg-[#e5e5e5] shadow-2xl">
          <img
            src="https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=1800&auto=format&fit=crop"
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
