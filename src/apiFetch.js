// 🔌 Shared fetch helper — P1 #31 (timeout) + #32 (401 auto-logout: user + admin)
// Saari API calls isse jaati hain. Timeout: signal pehle se ho toh use hi rehne do.
// 401 par session clear SIRF tab jab token pehle se tha (login-fail 401 se logout nahi hota).
const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_HOST = VITE_API_BASE_URL ? VITE_API_BASE_URL.replace(/\/api\/?$/, '') : 'https://roomkhojo-backend.vercel.app'; // P2 #58: sirf trailing /api strip

export const apiFetch = (url, options = {}) => {
  const opts = { ...options };
  if (!opts.signal && typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    opts.signal = AbortSignal.timeout(15000);
  }
  return fetch(url, opts).then((res) => {
    if (res.status === 401 && String(url).startsWith(API_HOST)) {
      const isAdmin = String(url).includes('/api/admin');
      const store = isAdmin ? sessionStorage : localStorage;
      const key = isAdmin ? 'roomkhojo_admin_token' : 'roomkhojo_token';
      if (store.getItem(key)) {
        // token tha = asli session-expiry (patchke parallel 401s par sirf pehla event)
        store.removeItem(key);
        if (!isAdmin) localStorage.removeItem('roomkhojo_user');
        window.dispatchEvent(new CustomEvent('rk:auth-expired', { detail: isAdmin ? 'admin' : 'user' }));
      }
    }
    return res;
  });
};
