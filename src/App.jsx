import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
};
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ContactUs from './components/ContactUs';
import ProductDemoModal from './components/ProductDemoModal';
import Home from './pages/Home';
import FAQPage from './pages/FAQPage';
import DetailPage from './pages/DetailPage';
import AdminPage from './pages/AdminPage';
import SupportExecutivePage from './pages/SupportExecutivePage';
import TeamPortalPage from './pages/TeamPortalPage';
import ClientTicketPage from './pages/ClientTicketPage';
import LiveChatPage from './pages/LiveChatPage';
import Product from './pages/Product';
import PlatformPage from './pages/PlatformPage';
import CareersPage from './pages/CareersPage';
import BlogPage from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';
import PodcastPage from './pages/PodcastPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import ContactPage from './pages/ContactPage';
import Analytics from './components/Analytics';
import ChatWidget from './components/ChatWidget';
import DpdpConsentBanner from './components/DpdpConsentBanner';
import { GlobalAudioProvider } from './components/GlobalAudioPlayer';
import defaultSiteContent from './data/siteContent.json';
import { fetchJson } from './common/fetchJson';

const scrollToHash = (hash) => {
  if (!hash) {
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }

  const target = document.getElementById(hash.replace('#', ''));
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};


const renameBrandStrings = (value) => {
  if (typeof value === 'string') return value.replace(/Pariksha [kK]i Taiyari/g, 'CrackXam');
  if (Array.isArray(value)) return value.map(renameBrandStrings);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renameBrandStrings(item)]));
  }
  return value;
};

const normalizeSiteContent = (content) => {
  if (!content) return content;
  const next = { ...renameBrandStrings(content) };

  const pages = [...(next.detailPages || [])];
  const featuresIdx = pages.findIndex((page) => page.path === '/product/features');
  const integrationsIdx = pages.findIndex((page) => page.path === '/product/integrations');
  if (featuresIdx !== -1 && integrationsIdx !== -1) {
    const integrations = pages[integrationsIdx];
    pages[featuresIdx] = {
      ...pages[featuresIdx],
      points: [...(pages[featuresIdx].points || []), ...(integrations.points || [])]
    };
    pages.splice(integrationsIdx, 1);
  }
  next.detailPages = pages;

  const products = next.productsPage?.products || [];
  if (next.footer?.columns && products.length) {
    next.footer = {
      ...next.footer,
      columns: next.footer.columns.map((column) => {
        if (column.title !== 'Products') return column;
        const productNames = products.map((product) => product.name);
        const kept = column.links.filter(
          (link) => link.label !== 'Integrations' && !productNames.includes(link.label)
        );
        return {
          ...column,
          links: [
            ...products.map((product) => ({
              label: product.name,
              action: { type: 'route', to: `/products?product=${product.id}` }
            })),
            ...kept
          ]
        };
      })
    };
  }

  return next;
};

const getPageTitle = (pathname, siteContent) => {
  const brandName = siteContent?.brand?.name || 'PATIENCE AI';
  const detailPages = siteContent?.detailPages || [];

  if (pathname === '/') return `${brandName} — Product-First AI for Governance & Enterprise Delivery`;
  if (pathname === '/products') return `${brandName} Products — Enterprise AI Suite | patienceai.in`;
  if (pathname === '/platform') return `${brandName} Platform & Services — Enterprise AI Infrastructure`;
  if (pathname === '/company/blog') return `${brandName} Case Studies & Blog — AI Insights | patienceai.in`;
  if (pathname === '/company/careers') return `${brandName} Careers — Join Our Team | patienceai.in`;
  if (pathname === '/admin') return `Admin Console | ${brandName}`;
  if (pathname === '/support-executive') return `Support Executive Console | ${brandName}`;
  if (pathname === '/team') return `Ticket Portal | ${brandName}`;
  if (pathname === '/my-ticket') return `Track Your Ticket | ${brandName}`;
  if (pathname === '/live-chat' || pathname === '/support-chat') return `Live Support | ${brandName}`;

  if (pathname.startsWith('/company/blog/')) {
    const slug = pathname.split('/').filter(Boolean).pop();
    const post = siteContent?.blogPage?.posts?.find((item) => item.slug === slug);
    return `${post?.title || 'Blog Post'} | ${brandName}`;
  }

  const detailPage = detailPages.find((page) => page.path === pathname);
  if (detailPage?.title) return `${detailPage.title} | ${brandName}`;

  return brandName;
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminRoute        = location.pathname === '/admin';
  const isExecRoute         = location.pathname === '/support-executive';
  const isTeamRoute         = location.pathname === '/team';
  const isMyTicketRoute     = location.pathname === '/my-ticket';
  const isLiveChatRoute     = location.pathname === '/live-chat' || location.pathname === '/support-chat';

  const [activeModal, setActiveModal] = useState(null);
  const [siteContent, setSiteContent] = useState(() => normalizeSiteContent(defaultSiteContent));

  // The site (and especially the admin console) is light-only. The team ticket
  // portal manages its own dark mode locally via a wrapper class, never here.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    let intervalId = 0;

    const loadSiteContent = async () => {
      if (isAdminRoute) {
        return;
      }

      try {
        const payload = await fetchJson('/api/site-content', { cache: 'no-store' });
        if (active && payload?.content) {
          setSiteContent(normalizeSiteContent(payload.content));
        }
      } catch {
        if (active) {
          setSiteContent(normalizeSiteContent(defaultSiteContent));
        }
      }
    };

    loadSiteContent();
    intervalId = window.setInterval(loadSiteContent, 4000);

    const handleSiteContentUpdate = () => {
      loadSiteContent();
    };

    window.addEventListener('storage', handleSiteContentUpdate);
    window.addEventListener('site-content-updated', handleSiteContentUpdate);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('storage', handleSiteContentUpdate);
      window.removeEventListener('site-content-updated', handleSiteContentUpdate);
    };
  }, [isAdminRoute]);

  useEffect(() => {
    document.title = getPageTitle(location.pathname, siteContent);
  }, [location.pathname, siteContent]);

  useEffect(() => {
    if (location.hash) {
      const timer = window.setTimeout(() => {
        scrollToHash(location.hash);
      }, 60);
      return () => window.clearTimeout(timer);
    }
    scrollToHash('');
    return undefined;
  }, [location.pathname, location.hash]);

  const handleAction = useCallback(
    (action) => {
      if (!action) return;

      if (action.type === 'modal') {
        setActiveModal(
          action.target === 'product-demo'
            ? { target: 'product-demo', product: action.product || null, back: Boolean(action.back) }
            : { target: 'sales', back: Boolean(action.back) }
        );
        return;
      }

      setActiveModal(null);

      if (action.type === 'route') navigate(action.to);
      if (action.type === 'routeHash') navigate(`${action.to}#${action.hash}`);
    },
    [navigate]
  );

  if (isAdminRoute) {
    return (
      <div className="admin-light min-h-screen bg-slate-50">
        <Routes>
          <Route path="/admin" element={
            <AdminPage onAction={handleAction} defaultContent={defaultSiteContent}
              currentContent={defaultSiteContent} currentContentSource="admin" onContentSaved={() => {}} />
          } />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    );
  }

  if (isExecRoute) {
    return (
      <Routes>
        <Route path="/support-executive" element={<SupportExecutivePage />} />
        <Route path="*" element={<Navigate to="/support-executive" replace />} />
      </Routes>
    );
  }

  if (isTeamRoute) {
    return (
      <Routes>
        <Route path="/team" element={<TeamPortalPage />} />
        <Route path="*" element={<Navigate to="/team" replace />} />
      </Routes>
    );
  }

  if (isMyTicketRoute) {
    return (
      <Routes>
        <Route path="/my-ticket" element={<ClientTicketPage />} />
        <Route path="*" element={<Navigate to="/my-ticket" replace />} />
      </Routes>
    );
  }

  if (isLiveChatRoute) {
    return (
      <Routes>
        <Route path="/live-chat" element={<LiveChatPage />} />
        <Route path="/support-chat" element={<LiveChatPage />} />
        <Route path="*" element={<Navigate to="/live-chat" replace />} />
      </Routes>
    );
  }

  const detailPages = siteContent.detailPages || [];

  return (
    <GlobalAudioProvider>
    <div className="min-h-screen bg-white text-[#1a1a1a]">
      <Navbar
        brand={siteContent.brand}
        navigation={siteContent.navigation}
        onAction={handleAction}
        currentPath={location.pathname}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={location.pathname} variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Product siteContent={siteContent} onAction={handleAction} />} />
            <Route path="/faqs" element={<FAQPage />} />
            <Route
              path="/platform"
              element={
                <PlatformPage
                  content={siteContent.platformPage}
                  possibilityContent={siteContent.possibilities}
                  onAction={handleAction}
                />
              }
            />
            <Route path="/company/blog" element={<BlogPage content={siteContent.blogPage} />} />
            <Route path="/company/blog/:slug" element={<BlogPostPage content={siteContent.blogPage} onAction={handleAction} />} />
            <Route path="/company/podcast" element={<PodcastPage content={siteContent.podcastPage} siteContent={siteContent} />} />
            <Route path="/company/careers" element={<CareersPage content={siteContent.careersPage} onAction={handleAction} />} />
            <Route path="/company/contact" element={<ContactPage siteContent={siteContent} />} />
            <Route path="/legal/privacy-policy" element={<PrivacyPolicy content={siteContent.legal?.privacyPolicy} />} />
            <Route path="/legal/terms-of-service" element={<TermsOfService content={siteContent.legal?.termsOfService} />} />
            {detailPages
              .filter((page) => !['/legal/privacy-policy', '/legal/terms-of-service', '/company/contact'].includes(page.path))
              .map((page) => (
                <Route key={page.path} path={page.path} element={<DetailPage pageContent={page} onAction={handleAction} />} />
              ))}
            <Route path="/admin" element={<Navigate to="/admin" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Footer brand={siteContent.brand} content={siteContent.footer} onAction={handleAction} />
        </motion.div>
      </AnimatePresence>

      <ContactUs
        content={siteContent.salesModal}
        isOpen={activeModal?.target === 'sales'}
        onClose={() => setActiveModal(null)}
        onBack={activeModal?.back ? () => setActiveModal(null) : undefined}
      />

      <ProductDemoModal
        content={siteContent.productDemoModal}
        product={activeModal?.product}
        isOpen={activeModal?.target === 'product-demo'}
        onClose={() => setActiveModal(null)}
        onBack={activeModal?.back ? () => setActiveModal(null) : undefined}
      />

      <Analytics />
      <ChatWidget brand={siteContent.brand} />
      <DpdpConsentBanner />
    </div>
    </GlobalAudioProvider>
  );
}

export default App;
