import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Each portal installs as its own standalone PWA (distinct id/scope/start_url),
// so we swap the <link rel="manifest"> + theme-color to match the current route.
// Anything else falls back to the marketing-site manifest declared in index.html.
const PORTAL_MANIFESTS = {
  '/team':              { href: '/manifest-team.webmanifest',    theme: '#0f172a' },
  '/admin':             { href: '/manifest-admin.webmanifest',   theme: '#0f172a' },
  '/support-executive': { href: '/manifest-support.webmanifest', theme: '#0f172a' },
  '/my-ticket':         { href: '/manifest-client.webmanifest',  theme: '#0f172a' },
};

const DEFAULT_MANIFEST = '/manifest.webmanifest';
const DEFAULT_THEME = '#0f172a';

export default function PortalManifest() {
  const { pathname } = useLocation();

  useEffect(() => {
    const portal = PORTAL_MANIFESTS[pathname];
    const link = document.querySelector('link[rel="manifest"]');
    const themeMeta = document.querySelector('meta[name="theme-color"]');

    if (link) link.setAttribute('href', portal ? portal.href : DEFAULT_MANIFEST);
    if (themeMeta) themeMeta.setAttribute('content', portal ? portal.theme : DEFAULT_THEME);
  }, [pathname]);

  return null;
}
