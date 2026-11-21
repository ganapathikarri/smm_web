import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { authApi, E164, toE164, type Session } from '../api/customerApi';

type Step = 'login' | 'register' | 'verify' | 'forgot' | 'reset';
const PENDING = 'smm-pending-verify'; // only a public id + phone; no secrets
const readPending = (): { publicId: string; phone: string } | null => { try { return JSON.parse(sessionStorage.getItem(PENDING) || 'null'); } catch { return null; } };
const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '');

export default function AuthScreens({ onSession }: { onSession: (s: Session) => void }) {
  const [step, setStep] = useState<Step>('login');
  const [phone, setPhone] = useState('');
  const [info, setInfo] = useState('');
  const [pending, setPending] = useState(readPending);

  const go = (s: Step, msg = '') => { setInfo(msg); setStep(s); };
  const titles: Record<Step, [string, string]> = {
    login: ['Welcome back', 'Sign in to order services and track your work.'],
    register: ['Create your account', 'Register with your mobile number. Verification is required before you can order.'],
    verify: ['Verify your phone', 'Enter the 6-digit code we sent to your mobile number.'],
    forgot: ['Reset your password', 'We will send a one-time code to your registered phone.'],
    reset: ['Choose a new password', 'Enter the code you received and set a new password (12+ characters).'],
  };

  return <div className="login-shell"><div className="login-left">
    <div className="login-brand"><div className="brand-mark"><Sparkles size={21} /></div><div className="brand-name">social<span>suite</span></div></div>
    <div className="login-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-center"><Sparkles size={36} /></div>
      <div className="floating-card floating-card-a"><Activity size={16} /><span>Human-reviewed delivery</span><strong>Transparent</strong></div>
      <div className="floating-card floating-card-b"><ShieldCheck size={17} /><span>Verified payments only</span><strong>Secure</strong></div></div>
    <div className="login-left-copy"><div className="eyebrow">CUSTOMER PORTAL</div><h1>Professional social media services, <span>delivered with care.</span></h1><p>Prepaid wallet, clear INR pricing and a live view of every order.</p></div>
  </div>
  <div className="login-right"><div className="login-form">
    <div className="login-form-top"><span className="eyebrow">CUSTOMER ACCESS</span><span className="secure-label"><LockKeyhole size={13} /> SECURE</span></div>
    <h2>{titles[step][0]}</h2><p className="login-subtitle">{titles[step][1]}</p>
    {info && <div className="notice notice-success cx-inline"><CheckCircle2 size={16} />{info}</div>}
    {step === 'login' && <LoginForm phone={phone} setPhone={setPhone} pending={pending} onSession={onSession} onVerify={() => go('verify')} onForgot={() => go('forgot')} onRegister={() => go('register')} />}
    {step === 'register' && <RegisterForm phone={phone} setPhone={setPhone} onSession={onSession} onDone={(p) => { sessionStorage.setItem(PENDING, JSON.stringify(p)); setPending(p); go('verify'); }} onLogin={() => go('login')} />}
    {step === 'verify' && <VerifyForm pending={pending} onDone={() => { sessionStorage.removeItem(PENDING); setPending(null); go('login', 'Phone verified. You can sign in now.'); }} onBack={() => go('login')} />}
    {step === 'forgot' && <ForgotForm phone={phone} setPhone={setPhone} onSent={() => go('reset', 'If an eligible account exists, a code has been sent.')} onBack={() => go('login')} />}
    {step === 'reset' && <ResetForm phone={phone} onDone={() => go('login', 'Password updated. Please sign in again.')} onBack={() => go('login')} />}
  </div><div className="login-right-foot">We never ask for your social-media passwords, OTPs or recovery codes.</div></div></div>;
}

function useSubmit() {
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const run = async (fn: () => Promise<void>) => { setError(''); setLoading(true); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setLoading(false); } };
  return { loading, error, run, setError };
}
const Err = ({ text }: { text: string }) => text ? <div className="form-error"><AlertTriangle size={15} />{text}</div> : null;
const Phone = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <><label>Mobile number</label><div className="input-wrap"><span className="input-prefix">+91</span><input value={value} onChange={e => onChange(e.target.value)} placeholder="10-digit mobile number" autoComplete="username" inputMode="tel" required /></div></>;
const Submit = ({ loading, children }: { loading: boolean; children: ReactNode }) => <button type="submit" className="btn btn-primary login-submit" disabled={loading}>{loading ? 'Please wait…' : children} <ArrowRight size={17} /></button>;
const Link = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => <button type="button" className="text-button cx-link" onClick={onClick}>{children}</button>;

function LoginForm({ phone, setPhone, pending, onSession, onVerify, onForgot, onRegister }: { phone: string; setPhone: (v: string) => void; pending: { publicId: string } | null; onSession: (s: Session) => void; onVerify: () => void; onForgot: () => void; onRegister: () => void }) {
  const [password, setPassword] = useState(''); const { loading, error, run, setError } = useSubmit();
  const submit = (e: FormEvent) => { e.preventDefault(); run(async () => {
    const p = toE164(phone); if (!E164.test(p)) throw new Error('Enter a valid mobile number.');
    try { onSession(await authApi.login({ phoneE164: p, password })); }
    catch (err) { throw new Error(err instanceof Error && err.message !== 'Invalid phone number or password' ? err.message : 'Invalid phone number or password, or your phone is not verified yet.'); }
  }); };
  return <form onSubmit={submit}>
    <Err text={error} />
    <Phone value={phone} onChange={setPhone} />
    <label>Password</label><input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" maxLength={72} required />
    <div className="cx-row"><Link onClick={onForgot}>Forgot password?</Link>{pending && <Link onClick={onVerify}>Verify my phone</Link>}</div>
    <Submit loading={loading}>Sign in</Submit>
    <GoogleButton onSession={onSession} onError={setError} text="continue_with" />
    <div className="cx-foot">New here? <Link onClick={onRegister}>Create an account</Link></div>
  </form>;
}

function GoogleMark() {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.9c-.58 2.96-2.25 5.47-4.73 7.16l7.64 5.93c4.46-4.12 7.17-10.2 7.17-17.56z" />
    <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.95 23.95 0 0 0 0 21.56l7.98-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.94-2.13 15.91-5.89l-7.64-5.93c-2.12 1.42-4.84 2.27-8.27 2.27-6.26 0-11.57-4.22-13.46-9.94l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>;
}

function GoogleButton({ onSession, onError, text = 'continue_with' }: { onSession: (s: Session) => void; onError: (m: string) => void; text?: 'signin_with' | 'signup_with' | 'continue_with' }) {
  const ref = useRef<HTMLDivElement>(null);
  const onSessionRef = useRef(onSession);
  const onErrorRef = useRef(onError);
  const [loadError, setLoadError] = useState('');

  useEffect(() => { onSessionRef.current = onSession; }, [onSession]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (!googleClientId.trim()) return;

    let cancelled = false;
    const renderGoogleButton = () => {
      const googleId = (window as any).google?.accounts?.id;
      if (cancelled || !googleId || !ref.current) return;
      try {
        googleId.initialize({
          client_id: googleClientId.trim(),
          callback: (response: { credential?: string }) => {
            if (!response.credential) {
              onErrorRef.current('Google did not return an ID token. Please try again.');
              return;
            }
            authApi.google(response.credential)
              .then(session => onSessionRef.current(session))
              .catch(error => onErrorRef.current(error instanceof Error ? error.message : 'Google sign-in failed.'));
          },
        });
        ref.current.innerHTML = '';
        googleId.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          width: Math.max(220, Math.min(385, Math.floor(ref.current.getBoundingClientRect().width || 385))),
          text,
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      } catch {
        setLoadError('Google sign-in could not be initialized. Check your Web OAuth Client ID and authorized JavaScript origins.');
      }
    };

    const existingGoogle = (window as any).google?.accounts?.id;
    if (existingGoogle) {
      renderGoogleButton();
      return () => { cancelled = true; };
    }

    const scriptId = 'google-identity-services';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const onLoad = () => renderGoogleButton();
    const onScriptError = () => setLoadError('Could not load Google Identity Services. Check your internet connection or content blockers.');
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onScriptError);
    // A script can already be loaded by another route before these listeners attach.
    if ((window as any).google?.accounts?.id) renderGoogleButton();

    return () => {
      cancelled = true;
      script?.removeEventListener('load', onLoad);
      script?.removeEventListener('error', onScriptError);
    };
  }, [text]);

  const label = text === 'signup_with' ? 'Sign up with Google' : text === 'signin_with' ? 'Sign in with Google' : 'Continue with Google';
  return <>
    <div className="cx-or"><span>or</span></div>
    {googleClientId.trim()
      ? <>
          <div ref={ref} className="cx-google" aria-label={label} />
          {loadError && <div className="google-setup-hint" role="status">{loadError}</div>}
        </>
      : <div className="cx-google-unconfigured">
          <button type="button" className="google-fallback-button" onClick={() => onError('Google sign-in is not configured yet. Add VITE_GOOGLE_CLIENT_ID to your .env.development file, then restart the Vite server.')}>
            <GoogleMark />
            <span>{label}</span>
          </button>
          <div className="google-setup-hint">Google sign-in needs your Web OAuth Client ID. Configure <code>VITE_GOOGLE_CLIENT_ID</code> to enable it.</div>
        </div>}
  </>;
}

function RegisterForm({ phone, setPhone, onSession, onDone, onLogin }: { phone: string; setPhone: (v: string) => void; onSession: (s: Session) => void; onDone: (p: { publicId: string; phone: string }) => void; onLogin: () => void }) {
  const [name, setName] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [ok, setOk] = useState(false); const { loading, error, run, setError } = useSubmit();
  const submit = (e: FormEvent) => { e.preventDefault(); run(async () => {
    const p = toE164(phone); if (!E164.test(p)) throw new Error('Enter a valid mobile number.');
    if (pw.length < 12) throw new Error('Password must contain at least 12 characters.'); if (pw !== pw2) throw new Error('Passwords do not match.');
    if (!ok) throw new Error('Please accept the Terms and Privacy Notice to continue.');
    const r = await authApi.register({ displayName: name.trim(), phoneE164: p, password: pw }); onDone({ publicId: r.publicId, phone: r.phoneE164 });
  }); };
  return <form onSubmit={submit}><Err text={error} />
    <label>Full name</label><input className="form-input" value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder="Your name" autoComplete="name" required />
    <Phone value={phone} onChange={setPhone} />
    <label>Password</label><input className="form-input" type="password" value={pw} onChange={e => setPw(e.target.value)} minLength={12} maxLength={72} placeholder="At least 12 characters" autoComplete="new-password" required />
    <label>Confirm password</label><input className="form-input" type="password" value={pw2} onChange={e => setPw2(e.target.value)} maxLength={72} autoComplete="new-password" required />
    <label className="checkbox-row"><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} /> I accept the Terms of Service and Privacy Notice</label>
    <Submit loading={loading}>Create account</Submit>
    <GoogleButton onSession={onSession} onError={setError} text="signup_with" />
    <div className="cx-foot">Already registered? <Link onClick={onLogin}>Sign in</Link></div></form>;
}

function VerifyForm({ pending, onDone, onBack }: { pending: { publicId: string; phone: string } | null; onDone: () => void; onBack: () => void }) {
  const [otp, setOtp] = useState(''); const [masked, setMasked] = useState(''); const [wait, setWait] = useState(0); const { loading, error, run, setError } = useSubmit();
  const sent = useRef(false);
  const send = () => { if (!pending) return; setError(''); authApi.sendOtp(pending.publicId).then(r => { setMasked(r.destinationMasked); setWait(Math.max(0, Math.ceil((new Date(r.resendAvailableAt.endsWith('Z') ? r.resendAvailableAt : `${r.resendAvailableAt}Z`).getTime() - Date.now()) / 1000))); }).catch(e => setError(e instanceof Error ? e.message : 'Could not send the code.')); };
  useEffect(() => { if (!sent.current) { sent.current = true; send(); } }, []);
  useEffect(() => { if (wait <= 0) return; const t = window.setTimeout(() => setWait(w => w - 1), 1000); return () => window.clearTimeout(t); }, [wait]);
  if (!pending) return <><div className="form-error"><AlertTriangle size={15} />No registration in progress on this device. Please register first, or sign in if your phone is already verified.</div><Link onClick={onBack}>Back to sign in</Link></>;
  const submit = (e: FormEvent) => { e.preventDefault(); run(async () => { if (!/^[0-9]{6}$/.test(otp)) throw new Error('Enter the 6-digit code.'); await authApi.verifyOtp(pending.publicId, otp); onDone(); }); };
  return <form onSubmit={submit}><Err text={error} />
    {masked && <p className="field-hint">Code sent to {masked}.</p>}
    <label>Verification code</label><input className="form-input code-input" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" required />
    <Submit loading={loading}>Verify phone</Submit>
    <div className="cx-row"><Link onClick={onBack}>Back to sign in</Link><button type="button" className="text-button cx-link" disabled={wait > 0} onClick={send}>{wait > 0 ? `Resend in ${wait}s` : 'Resend code'}</button></div></form>;
}

function ForgotForm({ phone, setPhone, onSent, onBack }: { phone: string; setPhone: (v: string) => void; onSent: () => void; onBack: () => void }) {
  const { loading, error, run } = useSubmit();
  const submit = (e: FormEvent) => { e.preventDefault(); run(async () => { const p = toE164(phone); if (!E164.test(p)) throw new Error('Enter a valid mobile number.'); await authApi.resetRequest(p); onSent(); }); };
  return <form onSubmit={submit}><Err text={error} /><Phone value={phone} onChange={setPhone} /><Submit loading={loading}>Send reset code</Submit><div className="cx-foot"><Link onClick={onBack}>Back to sign in</Link></div></form>;
}

function ResetForm({ phone, onDone, onBack }: { phone: string; onDone: () => void; onBack: () => void }) {
  const [otp, setOtp] = useState(''); const [pw, setPw] = useState(''); const { loading, error, run } = useSubmit();
  const submit = (e: FormEvent) => { e.preventDefault(); run(async () => { if (!/^[0-9]{6}$/.test(otp)) throw new Error('Enter the 6-digit code.'); if (pw.length < 12) throw new Error('Password must contain at least 12 characters.'); await authApi.resetConfirm({ phoneE164: toE164(phone), otp, newPassword: pw }); onDone(); }); };
  return <form onSubmit={submit}><Err text={error} />
    <label>Reset code</label><input className="form-input code-input" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit code" required />
    <label>New password</label><input className="form-input" type="password" value={pw} onChange={e => setPw(e.target.value)} minLength={12} maxLength={72} autoComplete="new-password" placeholder="At least 12 characters" required />
    <Submit loading={loading}>Update password</Submit><div className="cx-foot"><Link onClick={onBack}>Back to sign in</Link></div></form>;
}
