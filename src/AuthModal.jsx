import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, LifeBuoy, Loader2, Lock, Mail, Phone, ShieldCheck, User, X } from 'lucide-react';
import { apiFetch } from './apiFetch';
import AuthField, { PasswordToggle } from './AuthField';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://roomkhojo-backend.vercel.app').replace(/\/api\/?$/, '');
const GOOGLE_ENABLED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

const COPY = {
  login: { title: 'Sign in', subtitle: 'Welcome back — apna account access karein.', cta: 'Sign in' },
  signup: { title: 'Create account', subtitle: 'Free account banayein aur apna ad post karein.', cta: 'Create account' },
};

const AUTH_ISSUES = [
  { id: 'login', label: 'Login nahi ho raha' },
  { id: 'signup', label: 'Sign up nahi ho raha' },
  { id: 'otp', label: 'OTP nahi aa raha / galat' },
  { id: 'google', label: 'Google sign-in issue' },
  { id: 'other', label: 'Kuch aur account issue' },
];

const compressScreenshot = (file, maxDim = 1400, quality = 0.8) => new Promise((resolve) => {
  try {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob || blob.size >= file.size) return resolve(file);
          resolve(new File([blob], (file.name || 'screenshot').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      } catch { resolve(file); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  } catch { resolve(file); }
});

export default function AuthModal({ mode = 'login', onClose, onModeChange, onAuthed }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [otp, setOtp] = useState('');
  const [signupStep, setSignupStep] = useState('form'); // form | otp
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const [terms, setTerms] = useState(false);
  const [hint, setHint] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpIssue, setHelpIssue] = useState('login');
  const [helpMessage, setHelpMessage] = useState('');
  const [helpEmail, setHelpEmail] = useState('');
  const [helpPhone, setHelpPhone] = useState('');
  const [helpPhoto, setHelpPhoto] = useState(null);
  const [helpPhotoUrl, setHelpPhotoUrl] = useState('');
  const [helpPhotoBusy, setHelpPhotoBusy] = useState(false);
  const [helpBusy, setHelpBusy] = useState(false);
  const [helpError, setHelpError] = useState('');
  const [helpSent, setHelpSent] = useState(false);
  const [helpTicketId, setHelpTicketId] = useState('');
  const hintTimer = useRef(null);
  const termsRef = useRef(null);
  const dialogRef = useRef(null);
  const prevFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const flashHint = () => {
    setHint(true);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), 2200);
    termsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  useEffect(() => () => {
    if (helpPhotoUrl) URL.revokeObjectURL(helpPhotoUrl);
  }, [helpPhotoUrl]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    prevFocusRef.current = document.activeElement;
    const t = setTimeout(() => {
      dialogRef.current?.querySelector('input[type="text"], input[type="email"]')?.focus();
    }, 60);
    const onKey = (e) => {
      if (e.key === 'Escape') { onCloseRef.current && onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(dialogRef.current?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])
        .filter((el) => el.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      const prev = prevFocusRef.current;
      if (prev && typeof prev.focus === 'function') setTimeout(() => prev.focus(), 0);
    };
  }, []);

  const copy = COPY[mode] || COPY.login;
  const pwStrength = pass
    ? (pass.length >= 8 ? 1 : 0)
      + (/[a-z]/.test(pass) && /[A-Z]/.test(pass) ? 1 : 0)
      + (/\d/.test(pass) ? 1 : 0)
      + (/[^A-Za-z0-9]/.test(pass) ? 1 : 0)
    : 0;

  const cleanPhone = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  };

  const openHelp = () => {
    setHelpIssue(mode === 'signup' ? (signupStep === 'otp' ? 'otp' : 'signup') : 'login');
    setHelpMessage(error ? `Error: ${error}\n` : '');
    setHelpEmail(email.trim());
    setHelpPhone(cleanPhone(phone));
    setHelpError('');
    setHelpSent(false);
    setHelpTicketId('');
    setHelpPhoto(null);
    setHelpPhotoUrl('');
    setHelpOpen(true);
  };

  const pickHelpPhoto = async (e) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
      setHelpError('Sirf JPG, PNG ya WebP screenshot allowed hai.');
      return;
    }
    setHelpPhotoBusy(true);
    setHelpError('');
    try {
      const compressed = await compressScreenshot(file);
      if (compressed.size > 2 * 1024 * 1024) {
        setHelpError('Screenshot 2MB se chhoti honi chahiye. Chhota screenshot try karein.');
        return;
      }
      if (helpPhotoUrl) URL.revokeObjectURL(helpPhotoUrl);
      setHelpPhoto(compressed);
      setHelpPhotoUrl(URL.createObjectURL(compressed));
    } finally {
      setHelpPhotoBusy(false);
    }
  };

  const removeHelpPhoto = () => {
    if (helpPhotoUrl) URL.revokeObjectURL(helpPhotoUrl);
    setHelpPhoto(null);
    setHelpPhotoUrl('');
  };

  const submitHelp = async (e) => {
    e.preventDefault();
    if (helpMessage.trim().length < 10) return setHelpError('Dikkat thode detail me likhein (min 10 characters).');
    const helpEmailClean = helpEmail.trim();
    const helpPhoneClean = cleanPhone(helpPhone);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(helpEmailClean);
    if (!emailOk && !/^[6-9]\d{9}$/.test(helpPhoneClean)) {
      return setHelpError('Reply ke liye sahi email ya 10-digit mobile number dalein.');
    }
    setHelpBusy(true);
    setHelpError('');
    try {
      const fd = new FormData();
      fd.append('issueType', helpIssue);
      fd.append('message', helpMessage.trim());
      fd.append('contactEmail', helpEmailClean);
      fd.append('contactPhone', helpPhoneClean);
      if (helpPhoto) fd.append('images', helpPhoto);
      const res = await apiFetch(`${BASE_URL}/api/support/auth-help`, {
        method: 'POST',
        body: fd,
        signal: AbortSignal.timeout(60000),
      });
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (data.success) {
        setHelpSent(true);
        setHelpTicketId(data.ticket && data.ticket._id ? String(data.ticket._id) : '');
        setHelpPhoto(null);
        setHelpPhotoUrl('');
      } else {
        setHelpError(data.message || `Report bhej nahi paye (server ${res.status}). Dobara try karein.`);
      }
    } catch {
      setHelpError('Server se connection nahi bana. Internet check karke dobara try karein.');
    } finally {
      setHelpBusy(false);
    }
  };

  const signupBody = () => ({
    name: name.trim(),
    phone: cleanPhone(phone),
    email: email.trim(),
    password: pass,
    acceptedTerms: true,
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!terms) return flashHint();
    if (mode === 'signup' && name.trim().length < 2) return setError('Poora naam likhein.');
    if (mode === 'signup' && !/^[6-9]\d{9}$/.test(cleanPhone(phone))) return setError('Sahi 10-digit mobile number dalein.');
    if (!email.trim().includes('@')) return setError('Sahi email address dalein.');
    if (!pass) return setError('Password dalein.');
    if (mode === 'signup' && pass.length < 8) return setError('Password kam se kam 8 characters ka ho.');
    setBusy('email');
    setError('');
    setInfo('');
    try {
      const endpoint = mode === 'signup' ? 'signup/request-otp' : 'login';
      const body = mode === 'signup'
        ? signupBody()
        : { email: email.trim(), password: pass, acceptedTerms: true };
      const res = await apiFetch(`${BASE_URL}/api/users/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (data.success && mode === 'signup') {
        setSignupStep('otp');
        setOtp('');
        setInfo(data.maskedEmail ? `6-digit OTP ${data.maskedEmail} par bheja gaya hai. Inbox/spam check karein.` : 'Email par 6-digit OTP bhej diya gaya hai. Inbox/spam check karein.');
        setCooldown(60);
      } else if (data.success) {
        onAuthed && onAuthed(data.token, data.user, mode);
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

  const resendSignupOtp = async () => {
    if (cooldown > 0) return;
    setBusy('resend');
    setError('');
    setInfo('');
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/signup/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupBody()),
      });
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (data.success) {
        setInfo('Naya OTP bhej diya gaya hai.');
        setCooldown(60);
      } else {
        setError(data.message || 'OTP dobara nahi bhej paye.');
      }
    } catch {
      setError('Server se connection nahi bana. Dobara try karein.');
    } finally {
      setBusy(null);
    }
  };

  const verifySignupOtp = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) return setError('6-digit OTP dalein.');
    setBusy('verify');
    setError('');
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/signup/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), password: pass }),
      });
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (data.success) {
        onAuthed && onAuthed(data.token, data.user, 'signup');
        onClose && onClose();
      } else {
        setError(data.message || 'OTP verify nahi hua. Dobara try karein.');
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
        onAuthed && onAuthed(data.token, data.user, mode);
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={helpOpen ? 'Account help' : copy.title}
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{helpOpen ? 'Troubleshooting' : 'Secure account'}</p>
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

          <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-gray-900">{helpOpen ? 'Account help' : copy.title}</h2>
          <p className="mt-1 text-sm font-semibold text-gray-500">{helpOpen ? 'Login/signup me dikkat? Admin ko error aur screenshot bhejein.' : copy.subtitle}</p>

          {!helpOpen && !(mode === 'signup' && signupStep === 'otp') && (
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
          )}

          {!helpOpen && error && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p className="text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}

          {helpOpen ? (
            helpSent ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={26} />
                </div>
                <h3 className="mt-3 text-lg font-extrabold text-emerald-900">Report admin ko bhej di gayi</h3>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-emerald-800">
                  Admin aapke email/mobile par contact karke problem solve karega. Details aur screenshot (agar lagaya ho) ticket ke saath chali gayi hain.
                </p>
                {helpTicketId && (
                  <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-[10px] font-bold text-emerald-700">
                    Report ID: {helpTicketId.slice(-8).toUpperCase()}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => { setHelpOpen(false); setHelpSent(false); }}
                  className="mt-4 h-11 w-full rounded-xl bg-emerald-700 text-sm font-extrabold text-white active:scale-[0.99]"
                >
                  Wapas Sign in par
                </button>
                <button type="button" onClick={onClose} className="mt-2 text-xs font-bold text-emerald-700 underline">
                  Band karein
                </button>
              </div>
            ) : (
              <form onSubmit={submitHelp} noValidate className="mt-5 space-y-3.5">
                <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <LifeBuoy size={20} className="mt-0.5 shrink-0 text-blue-600" />
                  <p className="text-[11px] font-semibold leading-relaxed text-blue-800">
                    Login ya account banane me dikkat aa rahi hai? Yahan detail aur screenshot bhejein — admin panel me ticket turant chala jayega.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-extrabold text-gray-700">Kya dikkat aa rahi hai?</label>
                  <select
                    value={helpIssue}
                    onChange={(e) => setHelpIssue(e.target.value)}
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-800 outline-none focus:border-brand"
                  >
                    {AUTH_ISSUES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </div>

                <AuthField
                  label="Email (reply ke liye)"
                  icon={Mail}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={helpEmail}
                  onChange={(e) => setHelpEmail(e.target.value)}
                  disabled={helpBusy}
                />
                <AuthField
                  label="Mobile (optional)"
                  icon={Phone}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="10-digit mobile"
                  value={helpPhone}
                  onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); setHelpPhone((d.length > 10 && d.startsWith('91') ? d.slice(2, 12) : d).slice(0, 10)); }}
                  disabled={helpBusy}
                />

                <div>
                  <label className="mb-1.5 block text-xs font-extrabold text-gray-700">Dikkat detail me</label>
                  <textarea
                    value={helpMessage}
                    onChange={(e) => setHelpMessage(e.target.value.slice(0, 2000))}
                    rows={4}
                    placeholder="Kaunsa step par atka? Kya error dikh raha hai? OTP aa raha hai ya nahi?"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-bold text-gray-800 outline-none focus:border-brand resize-none"
                  />
                  <p className="mt-1 text-right text-[10px] font-bold text-gray-400">{helpMessage.length}/2000</p>
                </div>

                <div>
                  {helpPhotoUrl && (
                    <div className="relative mb-2 w-32">
                      <img src={helpPhotoUrl} className="h-24 w-32 rounded-xl border border-gray-200 object-cover" alt="Screenshot preview" />
                      <button
                        type="button"
                        onClick={removeHelpPhoto}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-black text-white shadow"
                        aria-label="Screenshot remove"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <label className="flex h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/30 bg-brand/5 text-xs font-bold text-brand">
                    <Camera size={20} />
                    {helpPhotoBusy ? 'Screenshot optimize ho raha hai…' : helpPhoto ? 'Screenshot badlein' : 'Screenshot lagayein (optional)'}
                    <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={pickHelpPhoto} disabled={helpPhotoBusy || helpBusy} />
                  </label>
                </div>

                {helpError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <p className="text-xs font-bold leading-relaxed">{helpError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={helpBusy || helpPhotoBusy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-extrabold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
                >
                  {helpBusy && <Loader2 size={17} className="animate-spin" />}
                  {helpBusy ? 'Admin ko bhej rahe hain…' : 'Report admin ko bhejein'}
                </button>

                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  className="flex h-10 w-full items-center justify-center gap-1.5 text-xs font-bold text-gray-500 hover:text-brand"
                >
                  <ArrowLeft size={14} /> Wapas Sign in/Sign up
                </button>
              </form>
            )
          ) : (
          <>
          {mode === 'signup' && signupStep === 'otp' ? (
            <form onSubmit={verifySignupOtp} className="mt-5 space-y-3.5">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <ShieldCheck size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs font-extrabold text-emerald-800">Email verification zaroori hai</p>
                  <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-emerald-700">
                    {info || '6-digit OTP aapke email par bheja gaya hai. Inbox/spam check karein.'}
                  </p>
                </div>
              </div>
              <AuthField
                label="Email OTP"
                icon={ShieldCheck}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={Boolean(busy)}
              />
              <button
                type="submit"
                disabled={Boolean(busy)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-extrabold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
              >
                {busy === 'verify' && <Loader2 size={17} className="animate-spin" />}
                {busy === 'verify' ? 'Verify ho raha hai…' : 'Verify & Create Account'}
              </button>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => { setSignupStep('form'); setOtp(''); setError(''); setInfo(''); }} className="text-xs font-bold text-gray-500 hover:text-brand">
                  Email/details badlein
                </button>
                <button type="button" onClick={resendSignupOtp} disabled={cooldown > 0 || Boolean(busy)} className="text-xs font-bold text-brand hover:underline disabled:text-gray-400 disabled:no-underline">
                  {busy === 'resend' ? 'Bhej rahe hain…' : cooldown > 0 ? `Resend ${cooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          ) : (
          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'signup' && (
              <>
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
                <AuthField
                  label="Mobile number"
                  icon={Phone}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="10-digit mobile (listing me prefill hoga)"
                  value={phone}
                  onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); setPhone((d.length > 10 && d.startsWith('91') ? d.slice(2, 12) : d).slice(0, 10)); }}
                  disabled={Boolean(busy)}
                />
              </>
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
            />
            <AuthField
              label="Password"
              icon={Lock}
              type={showPass ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'signup' ? 'Min 8 characters' : 'Aapka password'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              disabled={Boolean(busy)}
              right={<PasswordToggle show={showPass} onToggle={() => setShowPass((s) => !s)} />}
            />

            {mode === 'signup' && pass.length > 0 && (
              <div className="px-1">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${pwStrength > i ? (pwStrength <= 2 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <p className={`mt-1 text-[11px] font-bold ${pwStrength <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {pwStrength <= 2 ? 'Weak — 8+ characters, number/symbol use karein' : 'Strong password'}
                </p>
              </div>
            )}

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
              {busy === 'email' ? 'Please wait…' : mode === 'signup' ? 'Send Email OTP' : copy.cta}
            </button>
          </form>
          )}

          <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-3 text-center">
            <p className="text-[11px] font-semibold text-gray-500">Account nahi ban raha ya login nahi ho raha?</p>
            <button
              type="button"
              onClick={openHelp}
              className="mt-1.5 inline-flex items-center justify-center gap-1.5 text-xs font-extrabold text-brand hover:underline"
            >
              <LifeBuoy size={14} /> Troubleshooting — admin ko report karein
            </button>
          </div>

          {GOOGLE_ENABLED && !(mode === 'signup' && signupStep === 'otp') && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">or continue with Google</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <div className="relative flex justify-center">
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
            </>
          )}

          {!(mode === 'signup' && signupStep === 'otp') && (
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
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
