import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import { iconRegistry } from '../common/iconRegistry';
import { fetchJson } from '../common/fetchJson';
import { useNavigate } from 'react-router-dom';

const INITIAL_FORM = {
  name: '',
  email: '',
  role: '',
  message: ''
};

const CareersPage = ({ content, onAction }) => {
  const navigate = useNavigate();
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
      const response = await fetchJson('/api/contact', {
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

      if (response?.emailSent === true && response?.userConfirmationSent === true) {
        setSubmitStatus('success');
      } else {
        setSubmitStatus('error');
      }
      setFormData(INITIAL_FORM);
    } catch {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="bg-[#fbfaf7] pt-24">
      <section className="relative overflow-hidden border-b border-[#e3ddd1] bg-[#f4f1ea] px-6 pb-20 pt-24 md:pb-28">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#171717 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="mb-6 inline-block rounded-full border border-[#d8d2c7] bg-white px-5 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#171717] shadow-sm">
              {content.hero.eyebrow}
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }} className="mb-6 text-5xl font-medium leading-[0.92] tracking-[-0.06em] text-[#171717] md:text-7xl">
              {content.hero.title}
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }} className="text-lg leading-relaxed text-[#5f5a52] md:text-xl">
              {content.hero.description}
            </motion.p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {content.highlights.map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                className="rounded-[24px] border border-[#e3ddd1] bg-white p-5 shadow-[0_16px_45px_rgba(23,23,23,0.05)]"
              >
                <p className="text-sm leading-relaxed text-[#5f5a52]">{item}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-20 lg:grid-cols-[0.92fr_1.08fr] md:py-28">
        <div className="rounded-[30px] border border-[#e3ddd1] bg-[#f4f1ea] p-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#6f6b63]">Inquiry</p>
          <h2 className="mb-4 text-3xl font-medium tracking-[-0.04em] text-[#171717]">{content.form.title}</h2>
          <p className="mb-8 leading-relaxed text-[#5f5a52]">{content.form.description}</p>

          <div className="space-y-3">
            {(content.form.highlights || []).map((item) => (
              <div key={item} className="rounded-2xl border border-[#e3ddd1] bg-white px-5 py-4">
                <p className="leading-relaxed text-[#4a4a4a]">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-[#e3ddd1] bg-white p-8 shadow-[0_18px_55px_rgba(23,23,23,0.05)]">
          <AnimatePresence mode="wait">
            {submitStatus === 'success' ? (
              <motion.div
                key="careers-success"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="rounded-[24px] border border-[#e3ddd1] bg-[#f4f1ea] p-8"
              >
                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-2xl font-semibold">
                  ✓
                </div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-600">Sent</p>
                <h3 className="mb-3 text-2xl font-medium text-[#171717]">Inquiry received</h3>
                <p className="mb-8 leading-relaxed text-[#5f5a52]">
                  Your job enquiry has been received. We will be back to you once our respective team reviews.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setSubmitStatus('')}
                    className="rounded-full bg-[#171717] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
                  >
                    Send another inquiry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onAction) {
                        onAction({ type: 'route', to: '/products' });
                        return;
                      }
                      navigate('/products');
                    }}
                    className="rounded-full border border-[#d8d2c7] px-6 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#171717] transition-colors hover:border-[#171717]"
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
                        className="w-full rounded-[20px] border border-[#d8d2c7] bg-[#fbfaf7] px-4 py-3.5 text-[#1a1a1a] placeholder:text-[#9f988c] focus:border-[#171717] focus:outline-none"
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
                        className="w-full rounded-[20px] border border-[#d8d2c7] bg-[#fbfaf7] px-4 py-3.5 text-[#1a1a1a] placeholder:text-[#9f988c] focus:border-[#171717] focus:outline-none"
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#171717] px-8 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>
      </section>
    </main>
  );
};

export default CareersPage;
