import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'patienceai_dpdp_consent_v1';
const POLICY_VERSION = '2026-06-07-dpdp-v1';

const DEFAULT_PREFS = { essential: true, analytics: false, marketing: false };

const persistRemote = async (categories) => {
  try {
    await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories, policyVersion: POLICY_VERSION })
    });
  } catch {
    // best-effort: local consent already saved
  }
};

const saveLocal = (categories) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ categories, policyVersion: POLICY_VERSION, timestamp: Date.now() })
    );
  } catch {
    // storage may be blocked; banner will reappear next visit
  }
};

const DpdpConsentBanner = () => {
  const [visible, setVisible] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setVisible(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed?.policyVersion !== POLICY_VERSION) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const finalize = (categories) => {
    saveLocal(categories);
    persistRemote(categories);
    setVisible(false);
  };

  const handleAcceptAll = () => finalize({ essential: true, analytics: true, marketing: true });
  const handleRejectAll = () => finalize({ essential: true, analytics: false, marketing: false });
  const handleSavePrefs = () => finalize({ ...prefs, essential: true });

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="DPDP cookie and data consent"
      className="fixed inset-x-0 bottom-0 z-[9999] border-t border-[#e5e5e5] bg-white text-[#1a1a1a] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl text-sm leading-relaxed text-[#1a1a1a]">
            <h2 className="font-serif text-base font-medium text-[#1a1a1a]">
              Your data, your choice (DPDP Act, 2023)
            </h2>
            <p className="mt-2 text-[13px] text-[#444]">
              We process limited personal data to operate this site and improve our services. Categories we may
              collect:
            </p>
            <ul className="mt-2 list-disc pl-5 text-[13px] text-[#444]">
              <li><strong>Contact details</strong> you submit via forms — to respond to enquiries.</li>
              <li><strong>Usage analytics</strong> (device, page views) — to measure and improve the site.</li>
              <li><strong>Support chats</strong> — to provide assistance and quality review.</li>
            </ul>
            <p className="mt-2 text-[13px] text-[#444]">
              Essential cookies are always on. You can accept, reject, or pick categories. Read our{' '}
              <a href="/legal/privacy-policy" className="underline underline-offset-2 hover:text-black">privacy policy</a>.
            </p>
          </div>

          <div className="flex flex-shrink-0 flex-col gap-2 lg:items-end">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRejectAll}
                className="rounded-full border border-[#1a1a1a] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[#1a1a1a] transition-colors hover:bg-[#f5f5f5]"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => setManageOpen((v) => !v)}
                className="rounded-full border border-[#1a1a1a] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[#1a1a1a] transition-colors hover:bg-[#f5f5f5]"
                aria-expanded={manageOpen}
              >
                Manage Preferences
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="rounded-full bg-[#1a1a1a] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>

        {manageOpen && (
          <div className="mt-4 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex items-start gap-2 text-[13px] text-[#444]">
                <input type="checkbox" checked readOnly className="mt-0.5" />
                <span>
                  <strong className="block text-[#1a1a1a]">Essential</strong>
                  Required for site to function. Always on.
                </span>
              </label>
              <label className="flex items-start gap-2 text-[13px] text-[#444]">
                <input
                  type="checkbox"
                  checked={prefs.analytics}
                  onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <strong className="block text-[#1a1a1a]">Analytics</strong>
                  Anonymous usage to improve the site.
                </span>
              </label>
              <label className="flex items-start gap-2 text-[13px] text-[#444]">
                <input
                  type="checkbox"
                  checked={prefs.marketing}
                  onChange={(e) => setPrefs((p) => ({ ...p, marketing: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <strong className="block text-[#1a1a1a]">Marketing</strong>
                  Personalised outreach about our services.
                </span>
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleSavePrefs}
                className="rounded-full bg-[#1a1a1a] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-white transition-colors hover:bg-black"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DpdpConsentBanner;
