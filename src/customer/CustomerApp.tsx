import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { authApi, refreshSession, setSessionExpiredHandler, type Session } from '../api/customerApi';
import AuthScreens from './AuthScreens';
import Portal from './Portal';
import './customer.css';

/** Live customer application: real auth against /api/v1/auth/** and a portal wired to the customer APIs. */
export default function CustomerApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const booted = useRef(false); // refresh tokens rotate: bootstrap exactly once

  useEffect(() => {
    setSessionExpiredHandler(() => setSession(null));
    if (booted.current) return; booted.current = true;
    refreshSession().then(setSession).catch(() => setSession(null)).finally(() => setReady(true));
    return () => setSessionExpiredHandler(null);
  }, []);

  const logout = async () => { try { await authApi.logout(); } catch { /* clear locally regardless */ } setSession(null); };

  if (!ready) return <div className="splash"><div className="brand-mark"><Sparkles size={22} /></div><span>Connecting to SMM Platform…</span></div>;
  if (!session) return <AuthScreens onSession={setSession} />;
  if (!session.roles.includes('CUSTOMER')) return <AuthScreens onSession={setSession} />;
  return <Portal session={session} onLogout={logout} />;
}
