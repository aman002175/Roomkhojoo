import { Component, Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AlertTriangle } from 'lucide-react';
import PromoPopup from './PromoPopup';
import { apiFetch } from './apiFetch'; // P1 #31/#32: timeout + 401 auto-logout

// M6 fix: route-wise code splitting — pehla load chhota, baaki pages demand par
const MainApp = lazy(() => import('./MainApp'));
const AdminPanel = lazy(() => import('./AdminPanel'));
const UserDashboard = lazy(() => import('./UserDashboard'));
const LegalPage = lazy(() => import('./LegalPage'));
const Support = lazy(() => import('./Support'));

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://roomkhojo-api.onrender.com').replace(/\/api\/?$/, ''); // P2 #58: sirf trailing /api strip (beech ka '/api' nahi)
const DEFAULT_ADMIN_PATH = '/admin-secret-29';

// Path normalize: / se shuru ho, aas-paas space na ho
const normalizePath = (raw, fallback) => {
  const p = String(raw || fallback || DEFAULT_ADMIN_PATH).trim();
  return p.startsWith('/') ? p : `/${p}`;
};

const PageLoader = () => (
  <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-white gap-3">
    <p className="text-4xl font-black text-gray-800 tracking-tighter">Room<span className="text-brand">Khojo</span></p>
    <div className="flex gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2.5 h-2.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2.5 h-2.5 rounded-full bg-brand animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
    <p className="text-xs font-bold text-gray-400">Rooms dhoondh rahe hain…</p>
  </div>
);

// 🛡️ P2 #58: 404 page (pehle blank screen aati thi)
const NotFound = () => (
  <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-gray-50 gap-3 p-6 font-sans">
    <p className="text-6xl font-black text-gray-300">404</p>
    <p className="text-lg font-black text-gray-700">Ye page nahi mila</p>
    <p className="text-xs font-bold text-gray-400 text-center">Link galat ho sakta hai ya page hata diya gaya hai.</p>
    <Link to="/" className="mt-4 bg-brand text-white px-6 py-3 rounded-2xl font-black text-sm active:scale-95">← Home par wapas jao</Link>
  </div>
);

// 🛡️ P2 #58: ErrorBoundary — kisi bhi page ke crash par blank white screen ke bajaye saaf message
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('App crash:', error, info && info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-gray-50 gap-3 p-6 font-sans">
          <AlertTriangle size={48} className="text-amber-500" />
          <p className="text-lg font-black text-gray-700">Kuch gadbad ho gayi</p>
          <p className="text-xs font-bold text-gray-400 text-center max-w-xs">Page load karte waqt error aa gaya. Neeche button dabao — app theek ho jayega.</p>
          <button onClick={() => window.location.reload()} className="mt-4 bg-brand text-white px-6 py-3 rounded-2xl font-black text-sm active:scale-95">App Reload Karo</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // 🔑 Google Client ID ab .env file se aata hai (VITE_GOOGLE_CLIENT_ID)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // 🔒 Admin path BACKEND se aata hai (DB settings) — env sirf fallback.
  // Backend na mile toh VITE_ADMIN_PATH, warna default. (No extra fetch lib.)
  const [adminPath, setAdminPath] = useState(() => normalizePath(import.meta.env.VITE_ADMIN_PATH));

  useEffect(() => {
    apiFetch(`${API_BASE}/api/admin/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.settings && data.settings.adminPath) {
          setAdminPath(normalizePath(data.settings.adminPath));
        }
      })
      .catch(() => { /* backend na mile toh env/default path chalta rahega */ });
  }, []);

  if (!googleClientId) {
    console.warn('VITE_GOOGLE_CLIENT_ID set nahi hai — Google login button hide kar diya (email/password chalta rahega).');
  }

  const appTree = (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<MainApp />} />
          <Route path={adminPath} element={<AdminPanel />} />
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/support" element={<Support />} />

          {/* ── Legal Pages ── */}
          <Route path="/about" element={<LegalPage type="about" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/refund" element={<LegalPage type="refund" />} />

          {/* P2 #58: unknown URL → 404 (blank screen nahi) */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {/* P2 #62: Popup ab Router ke andar — route-exclude (dashboard/admin/support) ke liye */}
      <PromoPopup adminPath={adminPath} />
    </Router>
  );

  // P2 #58: clientId na ho toh provider mount NAHI karte (warna Google script/silent errors)
  return (
    <ErrorBoundary>
      {googleClientId ? (
        <GoogleOAuthProvider clientId={googleClientId}>{appTree}</GoogleOAuthProvider>
      ) : appTree}
    </ErrorBoundary>
  );
}
