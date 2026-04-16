import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ContactUs from './components/ContactUs';
import ProductDemoModal from './components/ProductDemoModal';
import HomePage from './pages/HomePage';
import DetailPage from './pages/DetailPage';
import AdminPage from './pages/AdminPage';
import ProductsPage from './pages/ProductsPage';
import PlatformPage from './pages/PlatformPage';
import CareersPage from './pages/CareersPage';
import BlogPage from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';
import ChatWidget from './components/ChatWidget';
import defaultSiteContent from './data/siteContent.json';
import { fetchJson } from './common/fetchJson';

const scrollToHash = (hash) => {
  if (!hash) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const target = document.getElementById(hash.replace('#', ''));
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

const getPageTitle = (pathname, siteContent) => {
  const brandName = siteContent?.brand?.name || 'PATIENCE AI';
  const detailPages = siteContent?.detailPages || [];

  if (pathname === '/') return `${brandName} / Home`;
  if (pathname === '/products') return `${brandName} / Products`;
  if (pathname === '/platform') return `${brandName} / Services`;
  if (pathname === '/company/blog') return `${brandName} / Case Studies`;
  if (pathname === '/company/careers') return `${brandName} / Careers`;
  if (pathname === '/admin') return `${brandName} / Admin`;

  if (pathname.startsWith('/company/blog/')) {
    const slug = pathname.split('/').filter(Boolean).pop();
    const post = siteContent?.blogPage?.posts?.find((item) => item.slug === slug);
    return `${brandName} / ${post?.title || 'Blog Post'}`;
  }

  const detailPage = detailPages.find((page) => page.path === pathname);
  if (detailPage?.title) return `${brandName} / ${detailPage.title}`;

  return brandName;
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminRoute = location.pathname === '/admin';

  const [activeModal, setActiveModal] = useState(null);
  const [siteContent, setSiteContent] = useState(defaultSiteContent);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('dark');
  }, []);

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
    const timer = window.setTimeout(() => {
      scrollToHash(location.hash);
    }, 60);

    return () => {
      window.clearTimeout(timer);
    };
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
          <Route
            path="/admin"
            element={
              <AdminPage
                onAction={handleAction}
                defaultContent={defaultSiteContent}
                currentContent={defaultSiteContent}
                currentContentSource="admin"
                onContentSaved={() => {}}
              />
            }
          />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    );
  }

  const detailPages = siteContent.detailPages || [];

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a]">
      <Navbar
        brand={siteContent.brand}
        navigation={siteContent.navigation}
        onAction={handleAction}
        currentPath={location.pathname}
      />

      <Routes>
        <Route path="/" element={<HomePage content={siteContent} onAction={handleAction} />} />
        <Route path="/products" element={<ProductsPage content={siteContent.productsPage} onAction={handleAction} />} />
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
        <Route path="/company/careers" element={<CareersPage content={siteContent.careersPage} onAction={handleAction} />} />
        {detailPages.map((page) => (
          <Route key={page.path} path={page.path} element={<DetailPage pageContent={page} onAction={handleAction} />} />
        ))}
        <Route path="/admin" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer brand={siteContent.brand} content={siteContent.footer} onAction={handleAction} />

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

      <ChatWidget brand={siteContent.brand} />
    </div>
  );
}

export default App;
