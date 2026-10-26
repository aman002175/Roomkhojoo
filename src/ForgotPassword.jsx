import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Loader2, Lock, Mail, ShieldCheck,
} from 'lucide-react';
import { apiFetch } from './apiFetch';
import AuthField, { PasswordToggle } from './AuthField';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://roomkhojo-backend.vercel.app').replace(/\/api\/?$/, '');
const STEPS = ['Email', 'Verify', 'Reset'];

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get('email') || '');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const goLogin = () => {
    sessionStorage.setItem('roomkhojo_need_login', '1');
    navigate('/');
  };

  const sendOtp = async () => {
    setError('');
    setInfo('');
    if (!email.trim().includes('@')) return setError('Sahi email address dalein.');
    setBusy(true);
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok || data.success === false) {
        setError(data.message || `OTP request fail hui (server ${res.status}). Thodi der baad try karein.`);
        if (res.status === 429) setCooldown(60);
        return;
      }
      setStep(2);
      setInfo(data.message || 'Agar ye email registered hai toh OTP bhej diya gaya hai.');
      setCooldown(60);
    } catch {
      setError('Server se connection nahi bana. Internet check karke dobara try karein.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    if (!/^\d{6}$/.test(otp.trim())) return setError('6-digit OTP dalein.');
    setBusy(true);
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (data.success && data.resetToken) {
        setResetToken(data.resetToken);
        setStep(3);
        setInfo('');
        setError('');
      } else {
        setError(data.message || 'OTP verify nahi hua. Dobara try karein.');
      }
    } catch {
      setError('Server se connection nahi bana. Internet check karke dobara try karein.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setError('');
    if (pass.length < 8) return setError('Password kam se kam 8 characters ka ho.');
    if (pass !== confirm) return setError('Dono passwords match nahi kar rahe.');
    setBusy(true);
    try {
      const res = await apiFetch(`${BASE_URL}/api/users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), resetToken, newPassword: pass }),
      });
      let data = {};
      try { data = await res.json(); } catch { data = {}; }
      if (data.success) {
        setStep(4);
        setError('');
      } else {
        setError(data.message || 'Password reset nahi hua. Dobara OTP mangwayein.');
      }
    } catch {
      setError('Server se connection nahi bana. Internet check karke dobara try karein.');
    } finally {
      setBusy(false);
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
          <p className="text-sm font-extrabold tracking-tight text-gray-800">Password reset</p>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center p-4 sm:items-center sm:p-6">
        <div className="w-full max-w-md rk-fade-in">
          <div className="rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <KeyRound size={20} />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-gray-900">
              {step === 4 ? 'Password badal gaya' : 'Password reset karein'}
            </h1>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-gray-500">
              {step === 1 && 'Registered email par 6-digit OTP bhejenge.'}
              {step === 2 && 'Email par aaya OTP dalein (10 minute tak valid).'}
              {step === 3 && 'Ab naya password set karein.'}
              {step === 4 && 'Ab naye password se sign in karein.'}
            </p>

            {step < 4 && (
              <div className="mt-5 flex items-center gap-2">
                {STEPS.map((label, i) => (
                  <div key={label} className="flex-1">
                    <div className={`h-1.5 rounded-full transition-colors ${step > i ? 'bg-brand' : 'bg-gray-200'}`} />
                    <p className={`mt-1.5 text-[10px] font-bold uppercase tracking-wide ${step === i + 1 ? 'text-brand' : 'text-gray-400'}`}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p className="text-xs font-bold leading-relaxed">{error}</p>
              </div>
            )}
            {info && !error && step === 2 && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                <p className="text-xs font-bold leading-relaxed">{info}</p>
              </div>
            )}

            {step === 1 && (
              <div className="mt-5 space-y-4">
                <AuthField
                  label="Registered email"
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  autoFocus
                  hint="OTP sirf email-password accounts par jaata hai. Google se banaye account me password reset nahi hota — Google se hi sign in karein."
                />
                <button
                  onClick={sendOtp}
                  disabled={busy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-extrabold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
                >
                  {busy && <Loader2 size={17} className="animate-spin" />}
                  {busy ? 'Bhej rahe hain…' : 'Send OTP'}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Mail size={15} className="shrink-0 text-gray-400" />
                    <p className="truncate text-xs font-bold text-gray-600">{email.trim()}</p>
                  </div>
                  <button
                    onClick={() => { setStep(1); setOtp(''); setError(''); setInfo(''); }}
                    className="shrink-0 text-xs font-bold text-brand hover:underline"
                  >
                    Change
                  </button>
                </div>
                <AuthField
                  label="6-digit OTP"
                  icon={KeyRound}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={busy}
                  autoFocus
                  className="text-center text-lg font-extrabold tracking-[0.45em]"
                />
                <button
                  onClick={verifyOtp}
                  disabled={busy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-extrabold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
                >
                  {busy && <Loader2 size={17} className="animate-spin" />}
                  {busy ? 'Verify ho raha hai…' : 'Verify OTP'}
                </button>
                <div className="text-center">
                  <button
                    onClick={sendOtp}
                    disabled={busy || cooldown > 0}
                    className="text-xs font-bold text-brand hover:underline disabled:text-gray-400 disabled:no-underline"
                  >
                    {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
                  </button>
                  <p className="mt-1 text-[11px] font-semibold text-gray-400">OTP nahi mila? Spam folder check karein.</p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="mt-5 space-y-4">
                <AuthField
                  label="New password"
                  icon={KeyRound}
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min 8 characters"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  disabled={busy}
                  autoFocus
                  right={<PasswordToggle show={showPass} onToggle={() => setShowPass((s) => !s)} />}
                />
                <AuthField
                  label="Confirm new password"
                  icon={Lock}
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Dobara wahi password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={busy}
                />
                <button
                  onClick={resetPassword}
                  disabled={busy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-extrabold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
                >
                  {busy && <Loader2 size={17} className="animate-spin" />}
                  {busy ? 'Save ho raha hai…' : 'Reset password'}
                </button>
              </div>
            )}

            {step === 4 && (
              <div className="mt-5 space-y-5">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-emerald-800">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  <p className="text-xs font-bold leading-relaxed">Password successfully badal gaya. Purane sessions invalid ho gaye hain — ab naye password se login karein.</p>
                </div>
                <button
                  onClick={goLogin}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-brand text-sm font-extrabold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99]"
                >
                  Sign in karein
                </button>
              </div>
            )}

            {step < 4 && (
              <p className="mt-5 border-t border-gray-100 pt-4 text-center text-xs font-semibold text-gray-400">
                Yaad aa gaya?{' '}
                <button onClick={goLogin} className="font-bold text-gray-600 hover:text-brand">Sign in</button>
              </p>
            )}
          </div>

          <p className="mt-4 px-3 text-center text-[11px] font-semibold leading-relaxed text-gray-400">
            Security ke liye OTP 10 minute me expire hota hai aur sirf ek baar use hota hai.
          </p>
        </div>
      </main>
    </div>
  );
}
