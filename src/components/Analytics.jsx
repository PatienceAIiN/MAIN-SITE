import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const getSessionId = () => {
  try {
    let id = sessionStorage.getItem('pa_session');
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('pa_session', id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2);
  }
};

const Analytics = () => {
  const location = useLocation();
  const prevPath = useRef(null);

  useEffect(() => {
    const path = location.pathname + location.search;
    if (path === prevPath.current) return;
    prevPath.current = path;

    const payload = {
      page: path,
      referrer: document.referrer || '',
      session_id: getSessionId(),
    };

    // Fire and forget — never block the user
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});

    // Also push to GA4 if loaded
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: path,
        page_title: document.title,
      });
    }

    // Also push to Clarity if loaded
    if (typeof window.clarity === 'function') {
      window.clarity('set', 'page', path);
    }
  }, [location.pathname, location.search]);

  return null;
};

export default Analytics;
