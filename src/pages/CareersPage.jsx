import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import FadeIn from '../common/FadeIn';
import SafeIcon from '../common/SafeIcon';
import { iconRegistry } from '../common/iconRegistry';
import { fetchJson } from '../common/fetchJson';

const INITIAL_FORM = {
  name: '',
  email: '',
  role: '',
  message: ''
};

const CareersPage = ({ content, onAction }) => {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('');

    try {
      await fetchJson('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: `Job Inquiry - ${formData.role || 'Career Opportunity'}`,
          message: `${formData.message}\n\nRole: ${formData.role || 'Not specified'}`,
          source: content.form.source
        })
      });

      setSubmitStatus('success');
      setFormData(INITIAL_FORM);
    } catch {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="bg-white pt-24">
      <section className="relative overflow-hidden bg-[#f4f4f4] px-6 pb-20 pt-24 md:pb-28">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(#000000 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <FadeIn className="max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="mb-6 inline-block rounded-full border border-[#d1d1d1] bg-white px-4 py-1.5 text-sm font-medium text-[#1a1a1a] shadow-sm">
              {content.hero.eyebrow}
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }} className="mb-6 font-serif text-5xl leading-[1.05] tracking-tight text-[#1a1a1a] md:text-7xl">
              {content.hero.title}
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }} className="text-lg leading-relaxed text-[#666666] md:text-xl">{content.hero.description}</motion.p>
          </FadeIn>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {content.highlights.map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                className="rounded-[20px] border border-[#e5e5e5] bg-white p-5 shadow-sm"
              >
                <p className="text-sm leading-relaxed text-[#666666]">{item}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-24 lg:grid-cols-[0.92fr_1.08fr] md:py-32">
        <FadeIn direction="left" className="rounded-[24px] border border-[#e5e5e5] bg-[#f4f4f4] p-8">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-[#a3a3a3]">Inquiry</p>
          <h2 className="mb-4 text-3xl font-medium tracking-tight text-[#1a1a1a]">{content.form.title}</h2>
          <p className="mb-8 leading-relaxed text-[#666666]">{content.form.description}</p>

          <div className="space-y-3">
            {(content.form.highlights || []).map((item) => (
              <div key={item} className="rounded-2xl border border-[#e5e5e5] bg-white px-5 py-4">
                <p className="leading-relaxed text-[#4a4a4a]">{item}</p>
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn direction="right" className="rounded-[24px] border border-[#e5e5e5] bg-white p-8 shadow-sm">
          <AnimatePresence mode="wait">
            {submitStatus === 'success' ? (
              <motion.div
                key="careers-success"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="rounded-[24px] border border-[#e5e5e5] bg-[#f4f4f4] p-8"
              >
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-2xl font-semibold">
                  ✓
                </div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-emerald-600">Sent</p>
                <h3 className="mb-3 text-2xl font-medium text-[#1a1a1a]">Inquiry received</h3>
                <p className="mb-8 leading-relaxed text-[#666666]">{content.form.statusMessages.success}</p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setSubmitStatus('')}
                    className="rounded-full bg-[#1a1a1a] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
                  >
                    Send another inquiry
                  </button>
                  <button
                    type="button"
                    onClick={() => onAction({ type: 'route', to: '/products' })}
                    className="rounded-full border border-[#d1d1d1] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#1a1a1a] transition-colors hover:border-[#1a1a1a]"
                  >
                    View products
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="careers-form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {content.form.fields.map((field) => (
                  <div key={field.name}>
                    <label htmlFor={field.name} className="mb-2 block text-sm font-medium text-[#1a1a1a]">
                      {field.label}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        id={field.name}
                        name={field.name}
                        value={formData[field.name]}
                        onChange={handleChange}
                        required={field.required}
                        rows={field.rows || 5}
                        placeholder={field.placeholder}
                        className="w-full rounded-[20px] border border-[#d1d1d1] bg-white px-4 py-3.5 text-[#1a1a1a] placeholder:text-[#a3a3a3] focus:border-[#1a1a1a] focus:outline-none"
                      />
                    ) : (
                      <input
                        id={field.name}
                        name={field.name}
                        type={field.type}
                        value={formData[field.name]}
                        onChange={handleChange}
                        required={field.required}
                        placeholder={field.placeholder}
                        className="w-full rounded-[20px] border border-[#d1d1d1] bg-white px-4 py-3.5 text-[#1a1a1a] placeholder:text-[#a3a3a3] focus:border-[#1a1a1a] focus:outline-none"
                      />
                    )}
                  </div>
                ))}

                {submitStatus === 'error' ? (
                  <div className="rounded-[20px] border border-red-200 bg-red-50 p-4 text-red-800" role="status" aria-live="polite">
                    {content.form.statusMessages.error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1a1a1a] px-8 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <SafeIcon
                    icon={iconRegistry[isSubmitting ? content.form.submitButton.loadingIcon : content.form.submitButton.idleIcon]}
                    className={`h-5 w-5 ${isSubmitting ? 'animate-spin' : ''}`}
                  />
                  {isSubmitting ? content.form.submitButton.loadingLabel : content.form.submitButton.idleLabel}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </FadeIn>
      </section>
    </main>
  );
};

export default CareersPage;
