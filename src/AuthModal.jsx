import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { AlertCircle, Loader2, Lock, Mail, User, X } from 'lucide-react';
import { apiFetch } from './apiFetch';
import AuthField, { PasswordToggle } from './AuthField';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://roomkhojo-api.onrender.com').replace(/\/api\/?$/, '');
const GOOGLE_ENABLED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

const COPY = {
  login: { title: 'Sign in', subtitle: 'Welcome back — apna account access karein.', cta: 'Sign in' },
  signup: { title: 'Create account', subtitle: 'Free account banayein aur apna ad post karein.', cta: 'Create account' },
};

export default function AuthModal({ open, mode = 'login', onClose, onModeChange, onAuthed }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [terms, setTerms] = useState(false);
  const [hint, setHint] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const hintTimer = useRef(null);
  const termsRef = useRef(null);

  const flashHint = () => {
    setHint(true);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), 2200);
    termsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  useEffect(() => {
    setError('');
    setBusy(null);
  }, [mode]);

  useEffect(() => {
    if (!open) {
      setPass('');
      setShowPass(false);
      setBusy(null);
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copy = COPY[mode] || COPY.login;

  const submit = async (e) => {
    e.preventDefault();
    if (!terms) return flashHint();
    if (mode === 'signup' && name.trim().length < 2) return setError('Poora naam likhein.');
    if (!email.trim().includes('@')) return setError('Sahi email address dalein.');
    if (!pass) return setError('Password dalein.');
    if (mode === 'signup' && pass.length < 6) return setError('Password kam se kam 6 characters ka ho.');
    setBusy('email');
    setError('');
    try {
      const endpoint = mode === 'signup' ? 'signup' : 'login';
      const body = mode === 'signup'
        ? { name: name.trim(), email: email.trim(), password: pass, acceptedTerms: true }
        : { email: email.trim(), password: pass, acceptedTerms: true };
      const res = await apiFetch(`${BASE_URL}/api/users/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (data.success) {
        onAuthed && onAuthed(data.token, data.user);
        onClose && onClose();
      } else {
        setError(data.message || `Request fail hui (server ${res.status}). Dobara try karein.`);
      }
    } catch {
      setError('Server se connection nahi bana. Internet check karke dobara try karein.');
    } finally {
      setBusy(null);
    }
  };

  const googleSuccess = async (credentialResponse) => {
    if (!terms) return flashHint();
    setBusy('google');
    setError('');
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: credentialResponse.credential, acceptedTerms: true }),
      });
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (data.success) {
        onAuthed && onAuthed(data.token, data.user);
        onClose && onClose();
      } else {
        setError(data.message || `Google sign-in fail hua (server ${res.status}).`);
      }
    } catch {
      setError('Server se connection nahi bana. Internet check karke dobara try karein.');
    } finally {
      setBusy(null);
    }
  };

  const legal = (path) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose && onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-[8000] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
        className="relative w-full max-h-[94dvh] overflow-y-auto rounded-t-[28px] border border-gray-100 bg-white shadow-2xl sm:max-w-[420px] sm:rounded-[28px] rk-sheet-in"
      >
        <div className="p-6 sm:p-7">
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200 sm:hidden" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Lock size={19} />
              </div>
              <div>
                <p className="text-sm font-extrabold tracking-tight text-gray-800">
                  Room<span className="text-brand">Khojo</span>
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Secure account</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
            >
              <X size={18} />
            </button>
          </div>

          <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-gray-900">{copy.title}</h2>
          <p className="mt-1 text-sm font-semibold text-gray-500">{copy.subtitle}</p>

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
            {[
              { id: 'login', label: 'Sign in' },
              { id: 'signup', label: 'Sign up' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onModeChange && onModeChange(t.id)}
                className={`h-10 rounded-lg text-sm font-bold transition-all ${mode === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p className="text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}

          {GOOGLE_ENABLED && (
            <>
              <div className="relative mt-4 flex justify-center">
                <GoogleLogin
                  onSuccess={googleSuccess}
                  onError={() => setError('Google sign-in fail hua. Dobara try karein.')}
                  useOneTap
                  shape="rectangular"
                  theme="outline"
                  size="large"
                  text="continue_with"
                  width="320"
                />
                {!terms && (
                  <button
                    type="button"
                    aria-label="Google se pehle terms checkbox tick karein"
                    onClick={flashHint}
                    className="absolute inset-0 z-10 cursor-not-allowed rounded-lg"
                  />
                )}
                {busy === 'google' && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-white/80">
                    <Loader2 size={18} className="animate-spin text-brand" />
                  </div>
                )}
              </div>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">or use email</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            </>
          )}

          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'signup' && (
              <AuthField
                label="Full name"
                icon={User}
                type="text"
                autoComplete="name"
                placeholder="Aapka poora naam"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={Boolean(busy)}
              />
            )}
            <AuthField
              label="Email address"
              icon={Mail}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={Boolean(busy)}
              autoFocus
            />
            <AuthField
              label="Password"
              icon={Lock}
              type={showPass ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'signup' ? 'Min 6 characters' : 'Aapka password'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              disabled={Boolean(busy)}
              right={<PasswordToggle show={showPass} onToggle={() => setShowPass((s) => !s)} />}
            />

            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { onClose && onClose(); navigate('/forgot-password'); }}
                  className="-mt-1 text-xs font-bold text-brand hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <label
              ref={termsRef}
              className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition-colors ${hint ? 'rk-shake border-rose-300 bg-rose-50' : 'border-transparent'}`}
            >
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => { setTerms(e.target.checked); if (e.target.checked) setHint(false); }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
              />
              <span className="text-[11px] font-semibold leading-relaxed text-gray-500">
                Main{' '}
                <button type="button" onClick={legal('/terms')} className="font-bold text-brand underline decoration-brand/30 underline-offset-2">Terms</button>,{' '}
                <button type="button" onClick={legal('/privacy')} className="font-bold text-brand underline decoration-brand/30 underline-offset-2">Privacy Policy</button>{' '}
                aur{' '}
                <button type="button" onClick={legal('/refund')} className="font-bold text-brand underline decoration-brand/30 underline-offset-2">Refund Policy</button>{' '}
                se sahmat hoon.
              </span>
            </label>
            {hint && <p className="-mt-1 px-1 text-[11px] font-bold text-rose-600">Sign in se pehle checkbox tick karein.</p>}

            <button
              type="submit"
              disabled={Boolean(busy)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-extrabold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
            >
              {busy === 'email' && <Loader2 size={17} className="animate-spin" />}
              {busy === 'email' ? 'Please wait…' : copy.cta}
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] font-semibold leading-relaxed text-gray-400">
            {mode === 'login' ? 'Naya account chahiye? ' : 'Pehle se account hai? '}
            <button
              type="button"
              onClick={() => onModeChange && onModeChange(mode === 'login' ? 'signup' : 'login')}
              className="font-bold text-gray-600 hover:text-brand"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
