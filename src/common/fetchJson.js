export const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await response.text();
  let data = null;

  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      // Non-JSON body (e.g. an HTML error page). Never surface raw HTML to the UI.
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      if (/^\s*<(?:!doctype|html|pre)/i.test(body)) {
        throw new Error('Unexpected server response');
      }
      const snippet = body.slice(0, 180).replace(/\s+/g, ' ');
      throw new Error(snippet || 'Invalid JSON response');
    }
  }

  if (!response.ok) {
    // Admin revoked this session — tell the whole app instantly (no refresh).
    if (response.status === 401 && data?.revoked && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pa-session-revoked', { detail: data.error }));
    }
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
};
