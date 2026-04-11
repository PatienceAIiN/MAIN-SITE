import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import { iconRegistry } from '../common/iconRegistry';
import { fetchJson } from '../common/fetchJson';

const INITIAL_FORM = {
  name: '',
  email: '',
  subject: '',
  message: ''
};

const ContactUs = ({ content, isOpen, onClose, onBack }) => {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSubmitStatus('');
      setFormData(INITIAL_FORM);
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value
    }));
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
          ...formData,
          source: content.source
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

  const topFields = content.fields.slice(0, 2);
  const subjectField = content.fields.find((field) => field.name === 'subject');
  const messageField = content.fields.find((field) => field.name === 'message');
  const successView = submitStatus === 'success';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[145] bg-slate-950/65 backdrop-blur-sm px-4 md:px-8 overflow-y-auto"
          style={{ paddingTop: 'clamp(0.9rem, 4vh, 2.5rem)', paddingBottom: 'clamp(0.9rem, 4vh, 2.5rem)' }}
          onClick={onClose}
        >
          <div className="min-h-full flex items-start justify-center">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="relative w-full max-w-6xl mx-auto rounded-[2.25rem] bg-white shadow-2xl overflow-y-auto max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-3rem)] border border-white/70"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.14),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.12),_transparent_40%)]" />
              <div className="relative grid lg:grid-cols-[0.92fr_1.08fr]">
                <div className="bg-[#0f172a] text-white px-6 py-8 md:px-8 md:py-10 lg:px-10 lg:py-12">
                <div className="flex items-start justify-between gap-4 mb-10">
                  <div className="max-w-md">
                    <p className="text-xs uppercase tracking-[0.35em] text-white/55 mb-4">Sales</p>
                    <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[0.96] mb-4">
                      {content.title}
                    </h2>
                    <p className="text-slate-300 text-base md:text-lg leading-relaxed">
                      {content.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {onBack && (
                      <motion.button
                        type="button"
                        onClick={onBack}
                        whileHover={{ x: -2 }}
                        whileTap={{ scale: 0.96 }}
                        aria-label="Back"
                        className="w-11 h-11 rounded-full border border-white/10 bg-white/5 text-white/80 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center"
                      >
                        <SafeIcon icon={iconRegistry.FiArrowLeft} className="w-5 h-5" />
                      </motion.button>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={content.closeLabel}
                      className="shrink-0 w-11 h-11 rounded-full border border-white/10 bg-white/5 text-white/80 hover:text-white hover:border-white/20 transition-colors flex items-center justify-center"
                    >
                      <SafeIcon icon={iconRegistry.FiX} className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-4">
                  {(content.highlights || []).map((item) => (
                    <div key={item} className="rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
                      <p className="text-sm text-slate-200 leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative bg-white px-6 py-8 md:px-8 md:py-10 lg:px-10 lg:py-12">
                <AnimatePresence mode="wait">
                  {successView ? (
                    <motion.div
                      key="contact-success"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="min-h-full flex items-center justify-center"
                    >
                      <div className="w-full rounded-[1.75rem] border border-slate-200 bg-slate-50 p-8 md:p-10 shadow-sm">
                        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-2xl font-semibold mb-5">
                          ✓
                        </div>
                        <p className="text-xs uppercase tracking-[0.35em] text-emerald-600 mb-3">Sent</p>
                        <h3 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-3">
                          Message received
                        </h3>
                        <p className="text-slate-600 leading-relaxed mb-8">
                          {content.statusMessages.success}
                        </p>

                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={() => setSubmitStatus('')}
                            className="w-full px-6 py-3.5 rounded-2xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
                          >
                            Send another message
                          </button>
                          <button
                            type="button"
                            onClick={onClose}
                            className="w-full px-6 py-3.5 rounded-2xl border border-slate-200 text-slate-700 font-medium hover:border-slate-300 hover:text-slate-900 transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="contact-form"
                      onSubmit={handleSubmit}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {topFields.map((field) => (
                          <div key={field.name}>
                            <label htmlFor={field.name} className="block text-sm font-medium text-slate-700 mb-2">
                              {field.label}
                            </label>
                            <input
                              type={field.type}
                              id={field.name}
                              name={field.name}
                              value={formData[field.name]}
                              onChange={handleChange}
                              required={field.required}
                              className="w-full px-4 py-3.5 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                              placeholder={field.placeholder}
                            />
                          </div>
                        ))}
                      </div>

                      <div>
                        <label htmlFor={subjectField.name} className="block text-sm font-medium text-slate-700 mb-2">
                          {subjectField.label}
                        </label>
                        <input
                          type={subjectField.type}
                          id={subjectField.name}
                          name={subjectField.name}
                          value={formData[subjectField.name]}
                          onChange={handleChange}
                          required={subjectField.required}
                          className="w-full px-4 py-3.5 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                          placeholder={subjectField.placeholder}
                        />
                      </div>

                      <div>
                        <label htmlFor={messageField.name} className="block text-sm font-medium text-slate-700 mb-2">
                          {messageField.label}
                        </label>
                        <textarea
                          id={messageField.name}
                          name={messageField.name}
                          value={formData[messageField.name]}
                          onChange={handleChange}
                          required={messageField.required}
                          rows={messageField.rows}
                          className="w-full px-4 py-3.5 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                          placeholder={messageField.placeholder}
                        />
                      </div>

                      {submitStatus === 'error' && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl" role="status" aria-live="polite">
                          <p className="text-red-800">{content.statusMessages.error}</p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full px-8 py-4 bg-slate-900 text-white font-medium rounded-2xl hover:bg-slate-800 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <SafeIcon
                              icon={iconRegistry[content.submitButton.loadingIcon]}
                              className="w-5 h-5 animate-spin"
                            />
                            {content.submitButton.loadingLabel}
                          </>
                        ) : (
                          <>
                            <SafeIcon icon={iconRegistry[content.submitButton.idleIcon]} className="w-5 h-5" />
                            {content.submitButton.idleLabel}
                          </>
                        )}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContactUs;
