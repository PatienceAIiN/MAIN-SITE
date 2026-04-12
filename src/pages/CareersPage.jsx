import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Button from '../components/ui/Button';
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

    const subject = `Job Inquiry - ${formData.role || 'Career Opportunity'}`;

    try {
      await fetchJson('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject,
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

  const handleReset = () => {
    setSubmitStatus('');
    setFormData(INITIAL_FORM);
  };

  const fields = content.form.fields;
  const successView = submitStatus === 'success';

  return (
    <main className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 px-6 py-16 md:px-10 lg:px-16 lg:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.18),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.1),_transparent_35%)]" />
        <div className="relative max-w-7xl mx-auto grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-xs md:text-sm uppercase tracking-[0.35em] text-slate-500 mb-5">{content.hero.eyebrow}</p>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[0.96] mb-6">
              {content.hero.title}
            </h1>
            <p className="max-w-2xl text-base md:text-lg text-slate-600 leading-relaxed">
              {content.hero.description}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {content.highlights.map((item) => (
              <div key={item} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 backdrop-blur-sm shadow-sm">
                <p className="text-sm text-slate-600 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-12 md:px-10 lg:px-16">
        <div className="max-w-7xl mx-auto grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 md:p-8 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-4">Inquiry</p>
            <h2 className="text-3xl font-semibold text-slate-900 mb-4">{content.form.title}</h2>
            <p className="text-slate-600 leading-relaxed mb-6">{content.form.description}</p>

            <div className="space-y-3">
              {(content.form.highlights || []).map((item) => (
                <div key={item} className="rounded-2xl bg-white border border-slate-100 px-5 py-4">
                  <p className="text-slate-700 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <AnimatePresence mode="wait">
              {successView ? (
                <motion.div
                  key="careers-success"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="min-h-full"
                >
                  <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-8 md:p-10 shadow-sm">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-2xl font-semibold mb-5">
                      ✓
                    </div>
                    <p className="text-xs uppercase tracking-[0.35em] text-emerald-600 mb-3">Sent</p>
                    <h3 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-3">
                      Inquiry received
                    </h3>
                    <p className="text-slate-600 leading-relaxed mb-8">{content.form.statusMessages.success}</p>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={handleReset}
                        className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
                      >
                        Send another inquiry
                      </button>
                      <Button
                        variant="secondary"
                        className="w-full sm:w-auto rounded-2xl px-6 py-3.5"
                        onClick={() => onAction({ type: 'route', to: '/products' })}
                      >
                        View products
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key="careers-form"
                  onSubmit={handleSubmit}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="space-y-5"
                >
                  {fields.map((field) => (
                    <div key={field.name}>
                      <label htmlFor={field.name} className="block text-sm font-medium text-slate-700 mb-2">
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
                          className="w-full px-4 py-3.5 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
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
                          className="w-full px-4 py-3.5 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        />
                      )}
                    </div>
                  ))}

                  {submitStatus === 'error' && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl" role="status" aria-live="polite">
                      <p className="text-red-800">{content.form.statusMessages.error}</p>
                    </div>
                  )}

                  <Button
                    variant="purple"
                    className="w-full rounded-2xl px-6 py-3.5"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <SafeIcon icon={iconRegistry.FiLoader} className="w-5 h-5 animate-spin mr-2" />
                        {content.form.submitButton.loadingLabel}
                      </>
                    ) : (
                      <>
                        <SafeIcon icon={iconRegistry.FiSend} className="w-5 h-5 mr-2" />
                        {content.form.submitButton.idleLabel}
                      </>
                    )}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </main>
  );
};

export default CareersPage;
