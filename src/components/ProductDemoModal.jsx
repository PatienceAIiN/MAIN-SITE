import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SafeIcon from '../common/SafeIcon';
import { iconRegistry } from '../common/iconRegistry';
import { fetchJson } from '../common/fetchJson';

const INITIAL_FORM = {
  productName: '',
  name: '',
  email: '',
  company: '',
  message: ''
};

const ProductDemoModal = ({ content, isOpen, product, onClose, onBack }) => {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSubmitStatus('');
      return;
    }

    setFormData((current) => ({
      ...INITIAL_FORM,
      productName: product?.name || current.productName || ''
    }));

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, product]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('');

    const subject = `Demo Request - ${formData.productName || product?.name || 'Product'}`;

    try {
      await fetchJson('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          subject,
          source: content.source,
          productName: formData.productName || product?.name || ''
        })
      });
      setSubmitStatus('success');
      setFormData({
        ...INITIAL_FORM,
        productName: formData.productName || product?.name || ''
      });
    } catch {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const productField = content.fields.find((field) => field.name === 'productName');
  const nameField = content.fields.find((field) => field.name === 'name');
  const emailField = content.fields.find((field) => field.name === 'email');
  const companyField = content.fields.find((field) => field.name === 'company');
  const messageField = content.fields.find((field) => field.name === 'message');

  const renderField = (field) => {
    const commonProps = {
      id: field.name,
      name: field.name,
      value: formData[field.name],
      onChange: handleChange,
      required: field.required,
      placeholder: field.placeholder,
      readOnly: field.readOnly
    };

    return field.type === 'textarea' ? (
      <textarea
        {...commonProps}
        rows={field.rows || 5}
        className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none bg-white"
      />
    ) : (
      <input
        {...commonProps}
        type={field.type}
        className={`w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
          field.readOnly ? 'bg-slate-50 text-slate-700' : 'bg-white'
        }`}
      />
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-slate-950/65 backdrop-blur-sm px-4 md:px-8 overflow-y-auto"
          style={{ paddingTop: 'clamp(0.9rem, 4vh, 2.5rem)', paddingBottom: 'clamp(0.9rem, 4vh, 2.5rem)' }}
          onClick={onClose}
        >
          <div className="min-h-full flex items-start justify-center">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-3xl rounded-[2rem] bg-white shadow-2xl overflow-y-auto max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-3rem)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_55%),radial-gradient(circle_at_top_right,_rgba(236,72,153,0.12),_transparent_50%)] pointer-events-none" />
              <div className="relative p-6 md:p-8 lg:p-10">
              <div className="flex items-start justify-between gap-4 mb-8">
                <div className="max-w-xl">
                  <p className="text-sm uppercase tracking-[0.3em] text-indigo-500 mb-3">Product demo</p>
                  <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-3">{content.title}</h2>
                  <p className="text-slate-600 text-base md:text-lg leading-relaxed">{content.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {onBack && (
                    <motion.button
                      type="button"
                      onClick={onBack}
                      whileHover={{ x: -2 }}
                      whileTap={{ scale: 0.96 }}
                      aria-label="Back"
                      className="w-11 h-11 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors flex items-center justify-center"
                    >
                      <SafeIcon icon={iconRegistry.FiArrowLeft} className="w-5 h-5" />
                    </motion.button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={content.closeLabel}
                    className="shrink-0 w-11 h-11 rounded-full border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors flex items-center justify-center"
                  >
                    <SafeIcon icon={iconRegistry.FiX} className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor={productField.name} className="block text-sm font-medium text-slate-700 mb-2">
                    {productField.label}
                  </label>
                  {renderField(productField)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[nameField, emailField].map((field) => (
                    <div key={field.name}>
                      <label htmlFor={field.name} className="block text-sm font-medium text-slate-700 mb-2">
                        {field.label}
                      </label>
                      {renderField(field)}
                    </div>
                  ))}
                </div>

                <div>
                  <label htmlFor={companyField.name} className="block text-sm font-medium text-slate-700 mb-2">
                    {companyField.label}
                  </label>
                  {renderField(companyField)}
                </div>

                <div>
                  <label htmlFor={messageField.name} className="block text-sm font-medium text-slate-700 mb-2">
                    {messageField.label}
                  </label>
                  {renderField(messageField)}
                </div>

                {submitStatus === 'success' && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-2xl">
                    <p className="text-green-800">{content.statusMessages.success}</p>
                  </div>
                )}

                {submitStatus === 'error' && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                    <p className="text-red-800">{content.statusMessages.error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-8 py-4 bg-indigo-600 text-white font-medium rounded-2xl hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <SafeIcon icon={iconRegistry[content.submitButton.loadingIcon]} className="w-5 h-5 animate-spin" />
                      {content.submitButton.loadingLabel}
                    </>
                  ) : (
                    <>
                      <SafeIcon icon={iconRegistry[content.submitButton.idleIcon]} className="w-5 h-5" />
                      {content.submitButton.idleLabel}
                    </>
                  )}
                </button>
              </form>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProductDemoModal;
