const GA_ID = 'G-KDSSBSYYQC';
const CONSENT_KEY = 'roomkhojo_analytics_consent';
export const ANALYTICS_CONSENT_EVENT = 'roomkhojo:analytics-consent';
export const ANALYTICS_CONSENT_CHANGED_EVENT = 'roomkhojo:analytics-consent-changed';

let loaded = false;
let disabled = false;

const storage = {
  get() {
    try { return window.localStorage.getItem(CONSENT_KEY); } catch { return null; }
  },
  set(value) {
    try { window.localStorage.setItem(CONSENT_KEY, value); } catch { /* private mode */ }
  }
};

export const getAnalyticsConsent = () => {
  const value = storage.get();
  return value === 'granted' || value === 'denied' ? value : null;
};

const clearAnalyticsCookies = () => {
  try {
    const host = window.location.hostname;
    document.cookie.split(';').forEach((part) => {
      const name = part.split('=')[0].trim();
      if (name !== '_ga' && name !== '_gid' && !name.startsWith('_ga_')) return;
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${host}; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${host}; SameSite=Lax`;
    });
  } catch { /* cookie access can be blocked */ }
};

const ensureGtag = () => {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
};

const sendPageView = (path) => {
  if (!loaded || disabled || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title || 'RoomKhojo'
  });
};

export const loadAnalytics = () => {
  if (!GA_ID || loaded) return;

  loaded = true;
  ensureGtag();
  if (!document.querySelector('script[data-roomkhojo-ga]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    script.dataset.roomkhojoGa = 'true';
    script.onerror = () => {
      loaded = false;
    };
    document.head.appendChild(script);
  }

  window.gtag('js', new Date());
  window.gtag('consent', 'default', {
    analytics_storage: getAnalyticsConsent() === 'granted' ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });
  window.gtag('config', GA_ID, {
    send_page_view: false,
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
};

export const initAnalytics = () => {
  loadAnalytics();
};

export const trackPageView = (path) => {
  if (disabled || getAnalyticsConsent() !== 'granted') return;
  if (!loaded) loadAnalytics();
  sendPageView(path);
};

export const setAnalyticsConsent = (granted) => {
  const next = granted ? 'granted' : 'denied';
  const changed = getAnalyticsConsent() !== next;
  storage.set(next);
  if (granted) {
    disabled = false;
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
    loadAnalytics();
  } else {
    disabled = true;
    clearAnalyticsCookies();
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
  }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
  if (changed) window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED_EVENT));
};

export const openAnalyticsConsent = () => {
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
};
