import React, { useState } from 'react';
import { motion } from 'framer-motion';
import FormStatus from './FormStatus';

const TOPICS = [
  { id: 'products', label: 'Products' },
  { id: 'podcast', label: 'Podcast' },
  { id: 'blog', label: 'Blog & updates' },
  { id: 'features', label: 'Features' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'legal', label: 'Terms & privacy' }
];

const DEFAULT_TOPICS = ['products', 'blog'];

const NewsletterForm = ({ tone = 'light' }) => {
  const [email, setEmail] = useState('');
  const [topics, setTopics] = useState(DEFAULT_TOPICS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ kind: null, message: '' });

  const toggleTopic = (id) => {
    setTopics((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id]
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatus({ kind: null, message: '' });

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, topics })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Subscription failed');
      setStatus({
        kind: 'success',
        message: data.message || "You're subscribed."
      });
      setEmail('');
    } catch (e) {
      setStatus({ kind: 'error', message: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const dark = tone === 'dark';
  const chipBase = dark
    ? 'border-white/20 bg-white/10 text-white hover:border-white/40'
    : 'border-[#d1d1d1] bg-white text-[#1a1a1a] hover:border-[#1a1a1a]';
  const chipActive = dark
    ? 'border-white bg-white text-[#1a1a1a]'
    : 'border-[#1a1a1a] bg-[#1a1a1a] text-white';

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={`flex-1 rounded-full border px-5 py-3 text-sm outline-none transition-colors ${
            dark
              ? 'border-white/20 bg-white/10 text-white placeholder-white/60 focus:border-white'
              : 'border-[#d1d1d1] bg-white text-[#1a1a1a] focus:border-[#1a1a1a]'
          }`}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className={`rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${
            dark
              ? 'bg-white text-[#1a1a1a] hover:bg-white/90'
              : 'bg-[#1a1a1a] text-white hover:bg-black'
          }`}
        >
          {isSubmitting ? 'Subscribing…' : 'Subscribe'}
        </button>
      </div>

      <div>
        <p className={`mb-2 text-[11px] font-bold uppercase tracking-[0.18em] ${dark ? 'text-white/60' : 'text-[#a3a3a3]'}`}>
          Email me about
        </p>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => {
            const active = topics.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTopic(t.id)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  active ? chipActive : chipBase
                }`}
              >
                {active ? '✓ ' : ''}{t.label}
              </button>
            );
          })}
        </div>
      </div>

      <FormStatus
        status={status.kind}
        title={status.kind === 'success' ? "You're subscribed" : status.kind === 'error' ? 'Subscription failed' : ''}
        message={status.message}
        onDismiss={() => setStatus({ kind: null, message: '' })}
      />
    </motion.form>
  );
};

export default NewsletterForm;
