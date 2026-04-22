import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Product from './pages/Product';
import ProductDetail from './pages/ProductDetail';
import Services from './pages/Services';
import UseCases from './pages/UseCases';
import ContactPage from './pages/ContactPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import AdminPage from './pages/AdminPage';
import ContactUs from './components/ContactUs';
import ProductDemoModal from './components/ProductDemoModal';
import defaultSiteContent from './data/siteContent.json';
import { fetchJson } from './common/fetchJson';

function App() {
  const [siteContent, setSiteContent] = useState(defaultSiteContent);
  const [activeModal, setActiveModal] = useState(null);

  useEffect(() => {
    let active = true;
    let intervalId = 0;

    const loadSiteContent = async () => {
      try {
        const payload = await fetchJson('/api/site-content', { cache: 'no-store' });
        if (active && payload?.content) {
          setSiteContent(payload.content);
        }
      } catch {
        if (active) {
          setSiteContent(defaultSiteContent);
        }
      }
    };

    loadSiteContent();
    intervalId = window.setInterval(loadSiteContent, 4000);

    const handleSiteContentUpdate = () => loadSiteContent();
    window.addEventListener('storage', handleSiteContentUpdate);
    window.addEventListener('site-content-updated', handleSiteContentUpdate);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('storage', handleSiteContentUpdate);
      window.removeEventListener('site-content-updated', handleSiteContentUpdate);
    };
  }, []);

  const openBeginJourney = useCallback(() => {
    setActiveModal({ target: 'sales' });
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  return (
    <>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminPage
              defaultContent={defaultSiteContent}
              currentContent={siteContent}
              currentContentSource="site"
              onContentSaved={(content) => setSiteContent(content)}
            />
          }
        />
        <Route
          path="/*"
          element={
            <Layout siteContent={siteContent} onBeginJourney={openBeginJourney}>
              <Routes>
                <Route path="/" element={<Home siteContent={siteContent} onBeginJourney={openBeginJourney} />} />
                <Route path="/product" element={<Product />} />
                <Route path="/products" element={<Product />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/services" element={<Services siteContent={siteContent} />} />
                <Route path="/platform" element={<Services siteContent={siteContent} />} />
                <Route path="/use-cases" element={<UseCases siteContent={siteContent} />} />
                <Route path="/company/blog" element={<UseCases siteContent={siteContent} />} />
                <Route path="/company/careers" element={<ContactPage siteContent={siteContent} />} />
                <Route path="/contact" element={<ContactPage siteContent={siteContent} />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/legal/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/legal/terms-of-service" element={<TermsOfService />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>

      <ContactUs content={siteContent.salesModal} isOpen={activeModal?.target === 'sales'} onClose={closeModal} />
      <ProductDemoModal
        content={siteContent.productDemoModal}
        product={activeModal?.product}
        isOpen={activeModal?.target === 'product-demo'}
        onClose={closeModal}
      />
    </>
  );
}

export default App;
