import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck,
} from 'lucide-react';
import { apiFetch } from './apiFetch';
import AuthField from './AuthField';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://roomkhojo-backend.vercel.app').replace(/\/api\/?$/, '');
const PENDING_KEY = 'roomkhojo_signup_pending';

const readPending = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
};

const maskEmail = (email) => {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return '';
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(2, Math.min(6, name.length - 2)))}@${domain}`;
};

const initialEmail = () => {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('email');
    if (fromQuery) return fromQuery.trim();
  } catch { /* ignore */ }
  return String(readPending().email || '').trim();
};

export default function VerifySignup() {
  const navigate = useNavigate();
  const [email] = useState(initialEmail);
  const [maskedEmail] = useState(() => {
    const pending = readPending();
    const currentEmail = initialEmail();
    return pending.email === currentEmail && pending.maskedEmail ? pending.maskedEmail : maskEmail(currentEmail);
  });
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => setCooldown((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!verified) return undefined;
    const timer = setTimeout(() => navigate('/', { replace: true }), 900);
    return () => clearTimeout(timer);
  }, [navigate, verified]);

  const verify = async (event) => {
    event.preventDefault();
    setError('');
    if (!email) return setError('Email address nahi mila. Signup dobara shuru karein.');
    if (!/^\d{6}$/.test(otp.trim())) return setError('6-digit OTP dalein.');
    setBusy('verify');
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/signup/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otp.trim() }),
      });
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (data.success && data.token && data.user) {
        localStorage.setItem('roomkhojo_token', data.token);
        localStorage.setItem('roomkhojo_user', JSON.stringify(data.user));
        try { sessionStorage.removeItem(PENDING_KEY); } catch { /* private mode */ }
        setVerified(true);
      } else {
        setError(data.message || 'OTP verify nahi hua. Dobara try karein.');
      }
    } catch {
      setError('Server se connection nahi bana. Internet check karke dobara try karein.');
    } finally {
      setBusy(null);
    }
  };

  const restart = () => {
    try { sessionStorage.removeItem(PENDING_KEY); } catch { /* private mode */ }
    navigate('/');
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    if (!email) return setError('Email address nahi mila. Signup dobara shuru karein.');
    setBusy('resend');
    setError('');
    setInfo('');
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/signup/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (data.success) {
        setInfo('Naya OTP bhej diya gaya hai. Inbox/spam check karein.');
        setCooldown(60);
      } else {
        setError(data.message || 'OTP dobara nahi bhej paye.');
      }
    } catch {
      setError('Server se connection nahi bana. Internet check karke dobara try karein.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center gap-3 px-4">
          <button
            onClick={() => navigate('/')}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200"
          >
            <ArrowLeft size={18} />
          </button>
          <p className="text-sm font-extrabold tracking-tight text-gray-800">Email verification</p>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center p-4 sm:items-center sm:p-6">
        <div className="w-full max-w-md rk-fade-in">
          <div className="rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <ShieldCheck size={20} />
            </div>

            {verified ? (
              <>
                <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-gray-900">Account ban gaya</h1>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-gray-500">
                  Email verify ho gaya. Ab aap RoomKhojo use kar sakte hain.
                </p>
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-emerald-800">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  <p className="text-xs font-bold leading-relaxed">Home par redirect ho raha hai…</p>
                </div>
              </>
            ) : (
              <>
                <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-gray-900">Email verify karein</h1>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-gray-500">
                  {maskedEmail
                    ? `${maskedEmail} par bheja gaya 6-digit OTP dalein (10 minute tak valid).`
                    : 'Email par bheja gaya 6-digit OTP dalein (10 minute tak valid).'}
                </p>

                <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
                  <Mail size={15} className="shrink-0 text-gray-400" />
                  <p className="truncate text-xs font-bold text-gray-600">{email || 'Email missing'}</p>
                </div>

                {error && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <p className="text-xs font-bold leading-relaxed">{error}</p>
                  </div>
                )}
                {info && !error && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    <p className="text-xs font-bold leading-relaxed">{info}</p>
                  </div>
                )}

                <form onSubmit={verify} className="mt-5 space-y-4">
                  <AuthField
                    label="6-digit OTP"
                    icon={KeyRound}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="••••••"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={Boolean(busy)}
                    autoFocus
                    className="text-center text-lg font-extrabold tracking-[0.45em]"
                  />
                  <button
                    type="submit"
                    disabled={Boolean(busy) || !email}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-extrabold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
                  >
                    {busy === 'verify' && <Loader2 size={17} className="animate-spin" />}
                    {busy === 'verify' ? 'Verify ho raha hai…' : 'Verify & Create Account'}
                  </button>
                </form>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={restart}
                    className="text-xs font-bold text-gray-500 hover:text-brand"
                  >
                    Signup dobara shuru karein
                  </button>
                  <button
                    type="button"
                    onClick={resend}
                    disabled={Boolean(busy) || cooldown > 0}
                    className="text-xs font-bold text-brand hover:underline disabled:text-gray-400 disabled:no-underline"
                  >
                    {busy === 'resend' ? 'Bhej rahe hain…' : cooldown > 0 ? `Resend ${cooldown}s` : 'Resend OTP'}
                  </button>
                </div>
              </>
            )}
          </div>

          <p className="mt-4 text-center text-[11px] font-semibold leading-relaxed text-gray-400">
            OTP ke liye app background me ja sakte hain — wapas aane par yahi page khula rahega.
          </p>
        </div>
      </main>
    </div>
  );
}
