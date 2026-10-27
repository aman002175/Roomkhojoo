import { useEffect, useState } from 'react';
import {
  ANALYTICS_CONSENT_EVENT,
  getAnalyticsConsent,
  setAnalyticsConsent
} from './analytics';

export default function CookieConsent() {
  const [isOpen, setIsOpen] = useState(() => getAnalyticsConsent() === null);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener(ANALYTICS_CONSENT_EVENT, open);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, open);
  }, []);

  if (!isOpen) return null;

  const choose = (granted) => {
    setAnalyticsConsent(granted);
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9000] p-3 sm:p-5" role="dialog" aria-label="Analytics cookie consent">
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-2xl">
        <p className="text-sm font-black text-gray-800">Analytics cookies?</p>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500">
          Hum optional Google Analytics use karna chahte hain taaki pata chale kaunse pages useful hain. Accept karne par Google ki <span className="font-black">_ga</span> cookies set hongi; Reject par kuch track nahi hoga.{' '}
          <a href="/privacy" className="font-black text-brand underline underline-offset-2">Privacy Policy</a>
        </p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => choose(false)}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-black text-gray-600 active:scale-95"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => choose(true)}
            className="rounded-xl bg-brand px-4 py-2 text-xs font-black text-white active:scale-95"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
