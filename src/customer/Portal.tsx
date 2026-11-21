import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BadgeCheck, Bell, Boxes, CheckCircle2, ClipboardList, House, LifeBuoy, LockKeyhole, LogOut,
  Plus, RefreshCw, Search, ShieldCheck, ShoppingBag, Sparkles, Tag, UserRound, Wallet, X, CreditCard, CircleHelp, Clock3, ExternalLink, Check, Info, XCircle, ArrowUpRight, Landmark, Smartphone, LayoutGrid,
} from 'lucide-react';
import { ApiError } from '../api/http';
import PlatformIcon from '../components/PlatformIcon';
import {
  authApi, customerApi, inr, when, type CatalogService, type CustomerProfile, type InputDef, type OrderDto, type Quote, type Session, type CreateTopupResponse,
} from '../api/customerApi';
import { openCheckout, type RazorpayCheckoutResult } from './razorpayCheckout';

type PageKey = 'home' | 'catalog' | 'orders' | 'wallet' | 'support' | 'updates' | 'profile';
const NAV: { key: PageKey; label: string; icon: ReactNode }[] = [
  { key: 'home', label: 'Discover', icon: <House size={17} /> }, { key: 'catalog', label: 'Services', icon: <Boxes size={17} /> },
  { key: 'orders', label: 'My orders', icon: <ClipboardList size={17} /> }, { key: 'wallet', label: 'Wallet', icon: <Wallet size={17} /> },
  { key: 'support', label: 'Support', icon: <LifeBuoy size={17} /> }, { key: 'updates', label: 'Updates', icon: <Bell size={17} /> },
  { key: 'profile', label: 'Account', icon: <UserRound size={17} /> },
];
const TITLES: Record<PageKey, string> = { home: 'Our services', catalog: 'Explore services', orders: 'My orders', wallet: 'My wallet', support: 'Support', updates: 'Updates', profile: 'My account' };

/* ---------- helpers ---------- */
function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [st, setSt] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true }); const [tick, setTick] = useState(0);
  useEffect(() => { let live = true; setSt(s => ({ ...s, loading: true, error: undefined })); fn().then(data => live && setSt({ data, loading: false })).catch(error => live && setSt({ error, loading: false })); return () => { live = false; }; }, [...deps, tick]); // eslint-disable-line
  return { ...st, reload: () => setTick(t => t + 1) };
}
function ModuleState({ error, hint, onRetry }: { error: Error; hint: string; onRetry?: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  const missing = status === 404 || status === 405;
  return <div className="customer-empty cx-state"><AlertTriangle size={18} />
    <strong>{missing ? 'This part of the backend is not available yet' : 'Could not load this section'}</strong>
    <span>{missing ? `The API for this screen (${hint}) has not been implemented — see API_CONTRACT.md.` : error.message}</span>
    {status ? <small>HTTP {status}</small> : null}{onRetry && <button className="btn btn-secondary btn-small" onClick={onRetry}><RefreshCw size={13} /> Retry</button>}</div>;
}
const tone = (s: string) => /ACTIVE|COMPLETED|CREDITED|APPROVED|RESOLVED|PUBLISHED/.test(s) ? 'ok' : /REJECT|CANCEL|FAIL|EXPIRED|BLOCK|REVERSED/.test(s) ? 'bad' : 'wait';
const Pill = ({ s }: { s: string }) => <span className={`status-pill cx-st-${tone(s)}`}>{s.replace(/_/g, ' ')}</span>;
function Modal({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {document.removeEventListener('keydown', onKey); document.body.style.overflow = oldOverflow; previous?.focus();};
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal cx-modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div><button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</div></div>;
}
const unitLabel = (u: string) => u === 'PER_1000' ? 'per 1,000' : u === 'PER_UNIT' ? 'per unit' : 'fixed price';
const initials = (n: string) => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

/* ---------- shell / direct routes / notifications ---------- */
const PAGE_PATHS: Record<PageKey, string> = {
  home: '/', catalog: '/services', orders: '/orders', wallet: '/wallet',
  support: '/support', updates: '/updates', profile: '/account',
};
function currentPage(): PageKey {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return (Object.keys(PAGE_PATHS) as PageKey[]).find(key => PAGE_PATHS[key] === path) ?? 'home';
}
type ToastKind = 'success' | 'error' | 'info' | 'warning';
type ToastItem = { id: number; kind: ToastKind; title: string; description?: string };
const toastIcon: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 size={20} />,
  error: <XCircle size={20} />,
  warning: <AlertTriangle size={20} />,
  info: <Info size={20} />,
};
export default function Portal({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [page, setPage] = useState<PageKey>(currentPage);
  const [topupsOpen, setTopupsOpen] = useState(() => new URLSearchParams(window.location.search).get('addFunds') === '1');
  const [suggestedAmount, setSuggestedAmount] = useState('500');
  const [walletVersion, setWalletVersion] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastCounter = useRef(0);
  const notify = (kind: ToastKind, title: string, description?: string) => {
    const id = ++toastCounter.current;
    setToasts(items => [...items.slice(-3), { id, kind, title, description }]);
    window.setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), 5600);
  };
  const say = (message: string) => notify('success', message);
  function go(next: PageKey) {
    setPage(next);
    const target = PAGE_PATHS[next];
    if (window.location.pathname !== target) window.history.pushState({}, '', target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  useEffect(() => {
    const onPop = () => setPage(currentPage());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  function openAddFunds(amount?: string) {
    setSuggestedAmount(amount || '500');
    setTopupsOpen(true);
    if (page !== 'wallet') go('wallet');
  }
  function closeAddFunds() {
    setTopupsOpen(false);
    if (window.location.search.includes('addFunds=')) window.history.replaceState({}, '', '/wallet');
  }
  const ctx: Ctx = { session, say, go, openAddFunds, notify, walletVersion };
  return <div className="customer-shell">
    <header className="customer-topbar">
      <div className="customer-brand"><div className="customer-brand-mark"><Sparkles size={20} /></div><div><strong>social<span>suite</span></strong><small>CUSTOMER PORTAL</small></div></div>
      <div className="customer-topbar-center"><span className="customer-live-dot" /> Signed in as <strong>{session.displayName}</strong></div>
      <div className="customer-topbar-actions">
        <button className="cx-top-wallet-link" onClick={() => go('wallet')}><Wallet size={16} /><span>My wallet</span></button>
        <button className="cx-top-add-button" onClick={() => openAddFunds()}><Plus size={16} /> Add funds</button>
        <button className="btn btn-secondary btn-small" onClick={onLogout}><LogOut size={14} /> Sign out</button><div className="customer-avatar">{initials(session.displayName)}</div>
      </div>
    </header>
    <nav className="cx-tabs" aria-label="Sections">{NAV.map(n => <button key={n.key} className={page === n.key ? 'active' : ''} onClick={() => go(n.key)}>{n.icon}<span>{n.label}</span></button>)}</nav>
    <div className="customer-layout">
      <aside className="customer-sidebar">
        <div className="customer-side-welcome"><div className="customer-avatar customer-avatar-large">{initials(session.displayName)}</div><div><strong>{session.displayName}</strong><span>Customer account</span></div></div>
        <div className="customer-nav-label">MY SPACE</div>
        {NAV.map(n => <button key={n.key} className={page === n.key ? 'customer-nav-item active' : 'customer-nav-item'} onClick={() => go(n.key)}>{n.icon} {n.label}{n.key === 'wallet' && <ArrowUpRight size={13} className="cx-nav-trailing" />}</button>)}
        <button className="cx-sidebar-topup" onClick={() => openAddFunds()}><span><Plus size={16} /></span><strong>Top up wallet</strong><small>Secure Razorpay checkout</small><ArrowRight size={17} /></button>
        <div className="customer-help-card"><ShieldCheck size={18} /><strong>Work with confidence</strong><p>Transparent services, clear pricing and human-reviewed delivery.</p></div>
      </aside>
      <main className="customer-main">
        <div className={`customer-page-heading ${page === 'home' ? 'cx-home-page-heading' : ''}`}><div><div className="eyebrow">SMM PLATFORM <span>/</span> CUSTOMER</div><h1>{TITLES[page]}</h1><p>{page === 'wallet' ? 'Add funds securely, track your balance and keep every payment clear.' : page === 'catalog' ? 'Explore approved services, compare prices and fund your next project.' : 'Discover professional social media services and track your work in one place.'}</p></div><div className="customer-heading-pill"><span className="customer-live-dot" /> Session active</div></div>
        {page === 'home' && <Home {...ctx} />}{page === 'catalog' && <Catalog {...ctx} />}{page === 'orders' && <Orders />}
        {page === 'wallet' && <WalletPage {...ctx} />}{page === 'support' && <Support {...ctx} />}{page === 'updates' && <Updates />}{page === 'profile' && <Profile onLogout={onLogout} />}
        <footer className="customer-footer"><span>© 2026 SMM Platform</span><span>Responsible social growth · Built for customers</span></footer>
      </main>
    </div>
    <div className="cx-toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map(item => <div key={item.id} className={`cx-notification cx-notification-${item.kind}`} role={item.kind === 'error' ? 'alert' : 'status'}>
        <span className="cx-notification-icon">{toastIcon[item.kind]}</span>
        <div className="cx-notification-copy"><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}</div>
        <button onClick={() => setToasts(prev => prev.filter(t => t.id !== item.id))} aria-label="Dismiss notification"><X size={16}/></button>
      </div>)}
    </div>
    {topupsOpen && <TopupModal initialAmount={suggestedAmount} onClose={closeAddFunds} onCredit={() => {setWalletVersion(v => v + 1); notify('success', 'Wallet credited!', 'Your verified payment was posted to your wallet.');}} notify={notify} />}
  </div>;
}
type Ctx = {
  session: Session;
  say: (message: string) => void;
  go: (page: PageKey) => void;
  openAddFunds: (amount?: string) => void;
  notify: (kind: ToastKind, title: string, description?: string) => void;
  walletVersion: number;
};

/* ---------- compact discover page / gently moving service rail ---------- */
const CAMPAIGN_MESSAGES = [
  { eyebrow: 'EXPLORE WHAT IS AVAILABLE', title: 'Ideas worth sharing, services worth exploring.', desc: 'Discover transparent pricing and clear deliverables before you book.', label: 'See services', target: 'catalog' as const },
  { eyebrow: 'PLAN YOUR NEXT CAMPAIGN', title: 'Turn your content plan into the next step.', desc: 'Browse creative support, planning and approved marketing services.', label: 'Explore catalogue', target: 'catalog' as const },
  { eyebrow: 'ONE WORKSPACE', title: 'Keep your projects and payments together.', desc: 'Your orders, progress updates and wallet are always in one place.', label: 'View orders', target: 'orders' as const },
];
function Home({ go, openAddFunds, walletVersion }: Ctx) {
  const [banner, setBanner] = useState(0);
  const [paused, setPaused] = useState(false);
  const services = useApi(() => customerApi.services({size: 12}));
  const wallet = useApi(() => customerApi.walletSummary(), [walletVersion]);
  const platforms = useApi(() => customerApi.platforms());
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setBanner(v => (v + 1) % CAMPAIGN_MESSAGES.length), 6300);
    return () => window.clearInterval(timer);
  }, [paused]);
  const msg = CAMPAIGN_MESSAGES[banner];
  function exploreService(publicId: string) {
    go('catalog');
    window.history.replaceState({}, '', `/services?service=${encodeURIComponent(publicId)}`);
  }
  return <div className="cx-home-v4">
    <section className="cx-promo-banner" aria-label="Discover offers and announcements" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={()=>setPaused(false)}>
      <div className="cx-promo-copy" aria-live="off" key={banner}>
        <span className="cx-promo-kicker"><Sparkles size={13}/> {msg.eyebrow}</span>
        <h2>{msg.title}</h2><p>{msg.desc}</p>
        <button onClick={() => go(msg.target)}>{msg.label} <ArrowRight size={16}/></button>
      </div>
      <div className="cx-promo-side"><span>DISCOVER · PLAN · DELIVER</span><div className="cx-promo-shape"><Sparkles size={41}/></div></div>
      <div className="cx-promo-controls" aria-label="Banner controls"><button aria-label="Previous banner" onClick={()=>setBanner(v=>(v+CAMPAIGN_MESSAGES.length-1)%CAMPAIGN_MESSAGES.length)}>‹</button>{CAMPAIGN_MESSAGES.map((_,i)=><button key={i} aria-label={`Show banner ${i+1}`} aria-current={banner===i?'true':undefined} className={banner===i?'active':''} onClick={()=>setBanner(i)}/>)}<button aria-label="Next banner" onClick={()=>setBanner(v=>(v+1)%CAMPAIGN_MESSAGES.length)}>›</button></div>
    </section>
    <div className="cx-home-slim-stats"><button onClick={()=>openAddFunds()}><Wallet size={17}/><strong>{wallet.data ? inr(wallet.data.availableBalance) : 'Wallet balance'}</strong><span>{wallet.error ? 'View wallet' : 'Available funds'}</span><ArrowRight size={15}/></button><button onClick={()=>go('orders')}><ClipboardList size={17}/><strong>Track orders</strong><span>Progress & history</span><ArrowRight size={15}/></button><button onClick={()=>go('catalog')}><LayoutGrid size={17}/><strong>All services</strong><span>Explore the full catalogue</span><ArrowRight size={15}/></button></div>
    <section className="cx-home-service-section" aria-label="Our services">
      <div className="cx-home-section-title"><div><span className="cx-promo-kicker">CURATED FOR YOUR WORK</span><h2>Our services <span className="cx-motion-dot"/></h2><p>Discover what's available. Hover or focus to pause the moving rail.</p></div><button className="cx-view-all" onClick={()=>go('catalog')}>View all <ArrowRight size={15}/></button></div>
      {services.loading ? <div className="customer-empty">Loading available services…</div> : services.error ? <ModuleState error={services.error} hint="GET /api/v1/catalog/services" onRetry={services.reload}/> : services.data?.items.length ?
      <div className="cx-service-viewport" role="region" aria-label="Scrolling service cards" tabIndex={0}>
        <div className={`cx-service-marquee ${services.data.items.length < 2 ? 'cx-static-marquee' : ''}`}>
          {[0,1].map(copy=><div className="cx-service-marquee-group" key={copy} aria-hidden={copy===1}>
            {services.data!.items.map(item=><article className="cx-service-marquee-card" key={`${copy}-${item.publicId}`}>
              <div className="cx-marquee-card-icon"><PlatformIcon code={item.platformCode ?? ''} size={28}/><span>AVAILABLE</span></div>
              <small>{item.categoryName}</small><h3>{item.name}</h3><p>{item.description}</p>
              <div className="cx-marquee-card-foot"><div><strong>{inr(item.rateAmount)}</strong><small>{unitLabel(item.rateUnit)}</small></div><button tabIndex={copy===1?-1:0} onClick={()=>exploreService(item.publicId)} aria-label={`Explore ${item.name}`}><ArrowRight size={16}/></button></div>
            </article>)}
          </div>)}
        </div>
      </div> : <div className="customer-empty">No services published yet. Check back soon.</div>}
    </section>
    <section className="cx-home-platform-section"><div className="cx-home-section-title"><div><span className="cx-promo-kicker">FIND YOUR CHANNEL</span><h2>Browse by platform</h2></div></div><div className="cx-home-platform-row">{(platforms.data ?? []).map(p=><button key={p.id} onClick={()=>{go('catalog');window.history.replaceState({},'',`/services?platform=${encodeURIComponent(p.code)}`);}}><PlatformIcon code={p.code} size={26}/><span>{p.name}</span><ArrowRight size={14}/></button>)}{platforms.error&&<button onClick={platforms.reload}>Retry platforms</button>}</div></section>
    <section className="cx-home-wallet-rail"><div className="cx-home-wallet-mark"><ShieldCheck size={21}/></div><div><strong>Transparent orders. Clear payment status.</strong><p>Wallet credits appear only after verified payments. Every service order has a trackable status.</p></div><button onClick={()=>go('wallet')}>My wallet <ArrowRight size={15}/></button></section>
  </div>;
}

/* ---------- catalog + order ---------- */
function Catalog({ say, go, openAddFunds }: Ctx) {
  const [platform, setPlatform] = useState(() => new URLSearchParams(window.location.search).get('platform') ?? ''); const [cat, setCat] = useState<number | null>(null); const [q, setQ] = useState(''); const [dq, setDq] = useState(''); const [pick, setPick] = useState<CatalogService | null>(null);
  useEffect(() => { const t = window.setTimeout(() => setDq(q), 300); return () => window.clearTimeout(t); }, [q]);
  const platforms = useApi(() => customerApi.platforms()); const cats = useApi(() => customerApi.categories());
  const list = useApi(() => customerApi.services({ platformCode: platform, categoryId: cat, q: dq }), [platform, cat, dq]);
  const shownCats = (cats.data ?? []).filter(c => !platform || c.platformId === null || platforms.data?.find(p => p.code === platform)?.id === c.platformId);
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get('service');
    const matched = target && list.data?.items.find(service => service.publicId === target);
    if (matched) {
      setPick(matched);
      window.history.replaceState({}, '', '/services');
    }
  }, [list.data]);
  return <section className="customer-section customer-catalog-section"><div className="cx-services-banner"><div className="cx-services-banner-icon"><Sparkles size={24} /></div><div><span>BUILT FOR YOUR BUSINESS</span><h2>Find your next growth service.</h2><p>Transparent pricing, clear deliverables and manual expert fulfilment.</p></div><button onClick={() => openAddFunds()}><Wallet size={16} /> Add funds</button></div>
    <div className="cx-catalog-instructions"><span><Check size={15}/> 1. Choose a platform</span><span><Check size={15}/> 2. Select a category</span><span><Check size={15}/> 3. Compare services</span></div>
    <div className="customer-filter-row"><div className="customer-category-filters"><button className={!platform ? 'selected' : ''} onClick={() => { setPlatform(''); setCat(null); }}>All platforms</button>{(platforms.data ?? []).map(p => <button key={p.id} className={platform === p.code ? 'selected' : ''} onClick={() => { setPlatform(p.code); setCat(null); }}><PlatformIcon code={p.code} name={p.name} size={22} />{p.name}</button>)}</div>
      <div className="customer-search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search services..." /></div></div>
    {shownCats.length > 0 && <div className="customer-category-filters cx-subfilters"><button className={cat === null ? 'selected' : ''} onClick={() => setCat(null)}>All categories</button>{shownCats.map(c => <button key={c.id} className={cat === c.id ? 'selected' : ''} onClick={() => setCat(c.id)}>{c.name}</button>)}</div>}
    {list.error ? <ModuleState error={list.error} hint="GET /api/v1/catalog/services" onRetry={list.reload} /> : list.loading ? <div className="customer-empty">Loading services…</div> :
      <div className="customer-service-grid">{(list.data?.items ?? []).map(s => <article className="customer-service-card" key={s.publicId}>
        <div className="customer-service-card-top"><span className="customer-platform-mini"><PlatformIcon code={s.platformCode || ""} size={32} /></span><span className="status-pill cx-st-ok">APPROVED</span></div>
        <div className="customer-service-platform">{s.platformCode ?? 'All platforms'} · {s.categoryName}</div><h3>{s.name}</h3><p>{s.description.length > 150 ? `${s.description.slice(0, 150)}…` : s.description}</p>
        <div className="customer-service-card-foot"><div><strong>{inr(s.rateAmount)}</strong><small>{unitLabel(s.rateUnit)}</small></div><button onClick={() => setPick(s)}>View & estimate <ArrowRight size={14} /></button></div></article>)}
        {list.data && !list.data.items.length && <div className="customer-empty">No approved services match your filters yet.</div>}</div>}
    {pick && <OrderModal service={pick} onClose={() => setPick(null)} onAddFunds={(amount) => {setPick(null); openAddFunds(amount);}} onCreated={number=>{setPick(null);say(`Order ${number} submitted successfully`);go('orders');}} />}
  </section>;
}

/** Phase 4: server-issued quote and atomic wallet reservation. */
function OrderModal({ service, onClose, onAddFunds, onCreated }: { service: CatalogService; onClose: () => void; onAddFunds: (amount?: string) => void; onCreated: (number: string) => void }) {
  const detail = useApi(() => customerApi.service(service.publicId));
  const defs: InputDef[] = detail.data?.inputs ?? [];
  const [qty, setQty] = useState(String(service.minimumQuantity));
  const [inputs, setInputs] = useState<Record<string,string>>({});
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [orderKey, setOrderKey] = useState<string | null>(null);
  const fixed = service.rateUnit === 'FIXED';
  const changeQty = (next: string) => {setQty(next);setQuote(null);setOrderKey(null);};
  async function calculate(e: FormEvent) {
    e.preventDefault(); setError('');const quantity = Number(qty);
    if (!Number.isSafeInteger(quantity) || quantity < service.minimumQuantity || quantity > service.maximumQuantity) {setError(`Quantity must be between ${service.minimumQuantity} and ${service.maximumQuantity}.`);return;}
    setBusy(true);
    try {setQuote(await customerApi.quote({servicePublicId:service.publicId,quantity}));setOrderKey(null);}catch(e){setError(e instanceof Error?e.message:'Unable to create quote');}finally{setBusy(false);}
  }
  async function submitOrder() {
    if (!quote || busy) return;
    setError('');
    if (new Date(quote.expiresAt.endsWith('Z')?quote.expiresAt:quote.expiresAt+'Z').getTime() <= Date.now()) {setQuote(null);setOrderKey(null);setError('Quote expired. Please calculate a fresh quote.');return;}
    for (const d of defs) {
      const val = (inputs[d.inputKey]??'').trim();
      if (d.required && !val) {setError(`${d.label} is required.`);return;}
      if (d.maxLength && val.length>d.maxLength) {setError(`${d.label} is too long.`);return;}
      if (/password|otp|secret|cookie|token|recovery|credential/i.test(d.inputKey+' '+d.label)){setError('Sensitive account secrets cannot be submitted.');return;}
    }
    const key = orderKey ?? crypto.randomUUID();setOrderKey(key);setBusy(true);
    try {const placed=await customerApi.createOrder({quoteId:quote.quoteId,inputs,customerNote:note.trim()||undefined},key);onCreated(placed.orderNumber);}catch(e){setError(e instanceof Error?e.message:'Unable to place order. Verify status before retrying.');}finally{setBusy(false);}
  }
  return <Modal title={service.name} sub="Server-verified price · Manual fulfilment" onClose={onClose}>
    <form className="form-stack" onSubmit={calculate}>
      <p>{detail.data?.description??service.description}</p>
      {detail.error&&<ModuleState error={detail.error} hint="GET /api/v1/catalog/services/{publicId}" />}
      <label className="modal-label" htmlFor="cx-qty">Quantity ({service.minimumQuantity}–{service.maximumQuantity})</label>
      <input id="cx-qty" type="number" min={service.minimumQuantity} max={service.maximumQuantity} step="1" className="form-input" value={qty} disabled={fixed||busy} onChange={e=>changeQty(e.target.value)} required />
      <div className="cx-input-security"><LockKeyhole size={16}/><span>Only public links and project details. Never enter passwords, OTPs or login credentials.</span></div>
      {defs.map(d=><div key={d.inputKey}><label className="modal-label" htmlFor={`cx-input-${d.inputKey}`}>{d.label} {d.required?'*':''}</label>
        {d.inputType==='SELECT' ? <select id={`cx-input-${d.inputKey}`} className="form-input" value={inputs[d.inputKey]??''} onChange={e=>setInputs(v=>({...v,[d.inputKey]:e.target.value}))} required={d.required}><option value="">Select an option</option>{(d.allowedValues??[]).map(v=><option key={v}>{v}</option>)}</select> : <input id={`cx-input-${d.inputKey}`} className="form-input" type={d.inputType==='NUMBER'?'number':d.inputType==='URL'?'url':'text'} maxLength={d.maxLength} value={inputs[d.inputKey]??''} onChange={e=>setInputs(v=>({...v,[d.inputKey]:e.target.value}))} placeholder={d.helpText??d.label} required={d.required}/>}
        {d.helpText&&<small className="field-hint">{d.helpText}</small>}</div>)}
      <label className="modal-label" htmlFor="cx-order-note">Instructions (optional)</label><textarea id="cx-order-note" className="form-input" rows={3} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Brief instructions for the fulfilment team" />
      {error&&<div className="form-error" role="alert"><AlertTriangle size={15}/>{error}</div>}
      {quote&&<div className="cx-quote" aria-live="polite"><div><span>Subtotal</span><strong>{inr(quote.subtotal)}</strong></div><div><span>Tax</span><strong>{inr(quote.taxAmount)}</strong></div><div className="cx-total"><span>Confirm wallet reservation</span><strong>{inr(quote.total)}</strong></div><small>Quote expires {when(quote.expiresAt)}. Confirming reserves this amount in your wallet; it is not a new Razorpay payment.</small></div>}
      <div className="cx-order-modal-footer"><button className="btn btn-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-secondary" type="submit" disabled={busy||!!detail.error}>{busy?'Working…':quote?'Recalculate quote':'Calculate price'}</button><button className="btn btn-primary" type="button" onClick={submitOrder} disabled={!quote||busy||!!detail.error}>{busy?'Submitting…':'Confirm & place order'}</button></div>
      <div className="cx-wallet-shortcut">Need more balance? <button type="button" onClick={()=>onAddFunds(quote?String(Math.ceil(Number(quote.total))):undefined)}>Add funds to wallet <ArrowRight size={14}/></button></div>
    </form>
  </Modal>;
}

/* ---------- orders ---------- */
function Orders() {
  const [status, setStatus] = useState(''); const [open, setOpen] = useState<string | null>(null);
  const list = useApi(() => customerApi.orders({ status }), [status]);
  const STAT = ['', 'PENDING_ADMIN_REVIEW', 'ACCEPTED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
  return <section className="customer-section"><div className="customer-section-head"><div><h2>Order history</h2><p>Track the status of your service requests.</p></div><span className="customer-small-tag">{status ? `${list.data?.items.length ?? 0} shown on this page` : `${list.data?.totalItems ?? 0} orders`}</span></div>
    <div className="customer-category-filters cx-subfilters">{STAT.map(s => <button key={s} className={status === s ? 'selected' : ''} onClick={() => setStatus(s)}>{s ? s.replace(/_/g, ' ').toLowerCase() : 'all'}</button>)}</div>
    {list.error ? <ModuleState error={list.error} hint="GET /api/v1/customer/orders" onRetry={list.reload} /> : <div className="customer-order-list">
      {(list.data?.items ?? []).map(o => <button className="customer-order-row cx-btnrow" key={o.orderNumber} onClick={() => setOpen(o.orderNumber)}><div className="customer-order-icon"><ShoppingBag size={18} /></div><div className="customer-order-info"><strong>{o.serviceName}</strong><small>{o.orderNumber} · Qty {o.quantity} · {when(o.submittedAt)}</small></div><strong className="customer-order-price">{inr(o.totalAmount)}</strong><Pill s={o.status} /></button>)}
      {list.data && !list.data.items.length && <div className="customer-empty">{status ? "No matching orders in the loaded page. Clear filters to explore other orders." : "No orders yet."}</div>}{list.loading && <div className="customer-empty">Loading…</div>}</div>}
    {open && <OrderDetail n={open} onClose={() => setOpen(null)} />}</section>;
}
function OrderDetail({ n, onClose }: { n: string; onClose: () => void }) {
  const d = useApi(() => customerApi.order(n));
  return <Modal title={`Order ${n}`} sub={d.data?.serviceName} onClose={onClose}>{d.error ? <ModuleState error={d.error} hint="GET /api/v1/customer/orders/{orderNumber}" /> : !d.data ? <div className="customer-empty">Loading…</div> : <>
    <div className="cx-quote"><div><span>Status</span><Pill s={d.data.status} /></div><div><span>Quantity</span><strong>{d.data.quantity}</strong></div><div className="cx-total"><span>Total</span><strong>{inr(d.data.totalAmount)}</strong></div></div>
    <h4 className="cx-h4">Timeline</h4><ol className="cx-timeline">{(d.data.timeline ?? []).map((t, i) => <li key={i}><Pill s={t.toStatus} /><span>{when(t.createdAt)}</span>{t.note && <p>{t.note}</p>}</li>)}</ol></>}</Modal>;
}

/* ---------- live wallet & Razorpay Standard Checkout ---------- */
function WalletPage({ openAddFunds, notify, walletVersion }: Ctx) {
  const sum = useApi(() => customerApi.walletSummary(), [walletVersion]);
  const led = useApi(() => customerApi.ledger(), [walletVersion]);
  const [initBusy, setInitBusy] = useState(false);
  const walletMissing = sum.error instanceof ApiError && sum.error.status === 404;
  async function initialize() {
    setInitBusy(true);
    try {
      await customerApi.initializeWallet();
      notify('success', 'Your wallet is ready', 'Your wallet starts at ₹0.00. You can add funds securely.');
      sum.reload();
    } catch (err) {
      notify('error', 'Could not initialize wallet', err instanceof Error ? err.message : 'Please retry.');
    } finally { setInitBusy(false); }
  }
  return <>
    <div className="cx-wallet-heading-card"><span className="cx-finance-kicker"><ShieldCheck size={15}/> YOUR FINANCIAL SPACE</span><h2>Everything you need for a seamless checkout.</h2><p>Track your wallet and add funds securely. You are always in control.</p></div>
    <section className="customer-wallet-layout cx-wallet-layout">
      <div className="customer-wallet-card cx-balance-card"><div className="cx-balance-top"><span><Wallet size={15}/> AVAILABLE BALANCE</span><span className="cx-secure-chip"><ShieldCheck size={12}/> Secure</span></div>
        <strong>{sum.data ? inr(sum.data.availableBalance) : sum.loading ? 'Loading…' : '—'}</strong>
        <small>{sum.data ? `Reserved for orders: ${inr(sum.data.reservedBalance)}` : 'Balance updates only after verified payment'}</small>
        <div className="cx-balance-actions"><button className="cx-balance-add" onClick={() => openAddFunds()}><Plus size={17}/> Add funds <ArrowRight size={16}/></button><button className="cx-balance-refresh" onClick={sum.reload} aria-label="Refresh wallet balance"><RefreshCw size={16}/></button></div>
        <div className="customer-wallet-card-foot"><LockKeyhole size={14}/> Protected by server-side payment verification</div>
      </div>
      <div className="customer-wallet-info cx-wallet-info"><span className="cx-finance-kicker">SIMPLE & SECURE</span><h2>Your funds. Your next big idea.</h2><p>Top up with Razorpay Standard Checkout, using payment methods available on your account. Your balance changes only after our backend verifies and posts the payment.</p>
        <div className="cx-wallet-perks"><div><CheckCircle2 size={16}/><span>Clear payment status</span></div><div><ShieldCheck size={16}/><span>Verified wallet credits</span></div><div><Activity size={16}/><span>Traceable activity</span></div></div>
        <button className="btn btn-primary cx-wallet-primary-btn" onClick={() => openAddFunds()}><Plus size={16}/> Add money to wallet <ArrowRight size={16}/></button>
        <small>Wallet funds are for approved services on this platform only. No transfers or cash-out.</small>
      </div>
    </section>
    {walletMissing && <div className="cx-wallet-setup"><div><span className="cx-wallet-setup-icon"><Wallet size={22}/></span><div><strong>Let's set up your wallet</strong><p>A secure zero-balance wallet is required before you can add funds.</p></div></div><button className="btn btn-primary" disabled={initBusy} onClick={initialize}>{initBusy ? 'Setting up…' : 'Create my wallet'}</button></div>}
    {sum.error && !walletMissing && <ModuleState error={sum.error} hint="GET /api/v1/customer/wallet/balance" onRetry={sum.reload} />}
    <section className="customer-section cx-ledger-section"><div className="customer-section-head"><div><h2>Transaction activity</h2><p>All wallet movements and payments, clearly recorded.</p></div><button className="cx-outline-refresh" onClick={led.reload}><RefreshCw size={15}/> Refresh</button></div>
      {led.error ? <div className="cx-ledger-unavailable"><Clock3 size={20}/><div><strong>Transaction history is not connected yet</strong><p>Wallet and Razorpay checkout can be used independently. The ledger statement API will show your records once the backend endpoint is available.</p></div></div>
      : led.loading ? <div className="customer-empty">Loading wallet activity…</div> : <div className="customer-order-list">{(led.data?.items ?? []).map(r => <div className="customer-order-row" key={r.id}><div className="customer-order-icon">{r.direction === 'CREDIT' ? '+' : '−'}</div><div className="customer-order-info"><strong>{r.displayDescription}</strong><small>{r.operationType.replace(/_/g, ' ')} · {when(r.createdAt)}</small></div><strong className={`customer-order-price ${r.direction === 'CREDIT' ? 'cx-credit' : ''}`}>{r.direction === 'CREDIT' ? '+' : '−'}{inr(r.amount)}</strong></div>)}{led.data && !led.data.items.length && <div className="customer-empty">No wallet activity yet. Your first verified top-up will appear here when the ledger API is ready.</div>}</div>}</section>
  </>;
}

type PaymentStage = 'entry' | 'creating' | 'checkout' | 'verifying' | 'pending' | 'order-pending' | 'credited';
function TopupModal({ initialAmount, onClose, notify, onCredit }: {
  initialAmount: string;
  onClose: () => void;
  notify: (kind: ToastKind, title: string, description?: string) => void;
  onCredit: () => void;
}) {
  const [amount, setAmount] = useState(initialAmount);
  const [stage, setStage] = useState<PaymentStage>('entry');
  const [order, setOrder] = useState<CreateTopupResponse | null>(null);
  const [error, setError] = useState('');
  const [key] = useState(() => crypto.randomUUID()); // one key per payment attempt, including retries
  const [lockedAmount, setLockedAmount] = useState<string | null>(null);
  const busy = stage === 'creating' || stage === 'verifying';
  const amountValid = /^\d{1,7}(?:\.\d{1,2})?$/.test(amount.trim()) && Number(amount) >= 1;
  async function checkout(currentOrder: CreateTopupResponse) {
    if (!currentOrder.razorpayOrderId || !currentOrder.razorpayKeyId) {
      setStage('order-pending');
      setError('Razorpay has not returned an order reference for this attempt. No Checkout was launched. Save the top-up reference and ask support to investigate before trying another payment.');
      notify('warning', 'Checkout not ready', 'Order creation is incomplete. No payment has started in this window.');
      return;
    }
    try {
      setStage('checkout');
      await openCheckout({
        orderId: currentOrder.razorpayOrderId,
        keyId: currentOrder.razorpayKeyId,
        amountInPaise: currentOrder.amountInPaise,
        onDismiss: () => { setStage('checkout'); notify('info', 'Checkout closed', 'Your payment order is saved. Reopen it when you are ready.'); },
        onFailed: message => { setStage('checkout'); notify('error', 'Payment was not completed', message); },
        onSuccess: result => { void verify(result, currentOrder); },
      });
    } catch (e) {
      setStage('checkout');
      setError(e instanceof Error ? e.message : 'Checkout could not be opened.');
      notify('error', 'Unable to open payment window', 'Please check your connection and try reopening Checkout.');
    }
  }
  async function verify(result: RazorpayCheckoutResult, currentOrder: CreateTopupResponse) {
    setStage('verifying'); setError('');
    notify('info', 'Payment submitted', 'Securely checking your payment with the backend.');
    try {
      const confirmed = await customerApi.verifyTopup({
        paymentIntentId: currentOrder.paymentIntentId,
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });
      if (confirmed?.walletCredited === true || confirmed?.status === 'CREDITED') {
        setStage('credited'); onCredit();
      } else {
        setStage('pending');
        notify('info', 'Payment being reviewed', 'Your wallet will update after successful backend verification and ledger posting.');
      }
    } catch (e) {
      setStage('pending');
      setError(e instanceof Error ? e.message : 'We could not confirm the payment yet.');
      notify('warning', 'Verification still pending', 'Do not pay again yet. Please check your payment status or contact support.');
    }
  }
  async function createOrder(e: FormEvent) {
    e.preventDefault(); setError('');
    if (!amountValid) { setError('Please enter an amount of at least ₹1, with up to two decimal places.'); return; }
    setStage('creating');
    try {
      const normalizedAmount = lockedAmount ?? Number(amount).toFixed(2);
      // A newly verified customer may not have a wallet yet. Initialization is
      // idempotent on the server and never adds funds or creates a payment.
      try {
        await customerApi.walletSummary();
      } catch (walletError) {
        if (walletError instanceof ApiError && walletError.status === 404
            && /wallet (not found|not initialized)/i.test(walletError.message)) {
          await customerApi.initializeWallet();
        } else {
          throw walletError;
        }
      }
      setLockedAmount(normalizedAmount);
      const created = await customerApi.createTopup(normalizedAmount, key);
      if (Math.round(Number(created.amount) * 100) !== Math.round(Number(normalizedAmount) * 100)) {
        throw new Error('The server returned a different payment amount. Contact support.');
      }
      setOrder(created);
      if (!created.razorpayOrderId || !created.razorpayKeyId) {
        setStage('order-pending');
        setError('Your top-up request was saved, but no Razorpay Order ID was returned. Checkout cannot open. Keep this reference for support.');
        notify('warning', 'Razorpay order not ready', 'Payment has not started. Keep this reference and do not repeat the same request.');
        return;
      }
      await checkout(created);
    } catch (e) {
      setStage('order-pending');
      setError(e instanceof Error ? e.message : 'Could not confirm payment order creation.');
      notify('error', 'Could not prepare Checkout', 'If an attempt may have been recorded, check its status with support before retrying.');
    }
  }
  async function copyReference() {
    if (!order?.topupNumber) return;
    try { await navigator.clipboard.writeText(order.topupNumber); notify('success', 'Reference copied', 'Include this top-up number when contacting support.'); }
    catch { notify('info', 'Reference available', 'Copy the top-up reference shown above for support.'); }
  }
  async function checkStatus() {
    if (!order) return;
    try {
      const result = await customerApi.topup(order.topupNumber);
      if (result.status === 'CREDITED') { setStage('credited'); onCredit(); }
      else notify('info', 'Payment not credited yet', `Current server status: ${result.status.replace(/_/g, ' ')}.`);
    } catch (e) { notify('warning', 'Status check unavailable', e instanceof Error ? e.message : 'Please contact support with your top-up reference.'); }
  }
  return <Modal title="Add funds to your wallet" sub="Secure payments powered by Razorpay · Only verified payments are credited" onClose={onClose}>
    <div className="cx-payment-modal">
      <div className="cx-payment-banner"><span><LockKeyhole size={17}/></span><div><strong>Secure wallet top-up</strong><p>Choose an amount, then pay using Razorpay Checkout.</p></div><span className="cx-payment-secure"><ShieldCheck size={14}/> Secure</span></div>
      {stage === 'entry' || (stage === 'pending' && !order) || stage === 'creating' ? <form onSubmit={createOrder} className="cx-payment-form">
        <label htmlFor="cx-amount">How much would you like to add?</label>
        <div className="cx-money-entry"><span>₹</span><input id="cx-amount" inputMode="decimal" autoFocus value={lockedAmount ?? amount} onChange={e => setAmount(e.target.value)} disabled={busy || lockedAmount !== null} placeholder="500.00" aria-describedby="cx-amount-help" /><span>INR</span></div>
        <small id="cx-amount-help">Minimum ₹1.00 · Maximum amount depends on your wallet limits.</small>
        <div className="cx-amount-options">{['200','500','1000','2000'].map(v => <button type="button" key={v} className={amount === v ? 'selected' : ''} onClick={() => setAmount(v)} disabled={busy || lockedAmount !== null}>{inr(v)}</button>)}</div>
        <div className="cx-payment-methods"><span>Available methods are shown inside Razorpay Checkout</span><div><span><Smartphone size={17}/> UPI apps</span><span><Landmark size={17}/> Netbanking</span><span><CreditCard size={17}/> Cards</span></div><small>Options depend on your Razorpay account and payment eligibility. This site never asks for bank passwords or UPI PINs.</small></div>
        {error && <div className="cx-payment-error"><AlertTriangle size={17}/><span>{error}</span></div>}
        <button className="cx-checkout-main" type="submit" disabled={busy || (!amountValid && lockedAmount === null)}>{stage === 'creating' ? <><RefreshCw className="cx-spin" size={18}/> Preparing payment…</> : <><CreditCard size={19}/> Continue to Razorpay <ArrowRight size={18}/></>}</button>
      </form> : <div className="cx-payment-result">
        <div className="cx-payment-total"><span>Payment amount</span><strong>{order ? inr(order.amount) : inr(amount)}</strong></div>
        <div className="cx-payment-stage"><span className={`cx-stage-icon cx-stage-${stage}`}>{stage === 'credited' ? <CheckCircle2 size={25}/> : stage === 'verifying' ? <RefreshCw size={24} className="cx-spin"/> : (stage === 'pending' || stage === 'order-pending') ? <Clock3 size={24}/> : <CreditCard size={24}/>}</span>
          <h3>{stage === 'credited' ? 'Wallet successfully credited!' : stage === 'verifying' ? 'Verifying your payment…' : stage === 'order-pending' ? 'Razorpay order not ready' : stage === 'pending' ? 'Payment verification pending' : 'Ready for secure payment'}</h3>
          <p>{stage === 'credited' ? 'The backend has confirmed your wallet credit.' : stage === 'verifying' ? 'Please do not close this window while we confirm the payment.' : stage === 'order-pending' ? 'Razorpay order creation has not been confirmed. Checkout cannot start without a valid Razorpay Order ID. No payment was initiated through this window.' : stage === 'pending' ? 'A payment was attempted. Do not pay again until its status is confirmed. Save the reference for support.' : 'Your secure Razorpay order is ready. You can reopen Checkout.'}</p>
        </div>
        {order && <div className="cx-payment-reference"><span>TOP-UP REFERENCE</span><strong>{order.topupNumber}</strong><span>RAZORPAY ORDER</span><strong>{order.razorpayOrderId || 'Pending creation'}</strong></div>}
        {error && <div className="cx-payment-error"><AlertTriangle size={17}/><span>{error}</span></div>}
        <div className="cx-payment-actions">
          {stage === 'checkout' && order?.razorpayOrderId && <button className="cx-checkout-main" onClick={() => void checkout(order)}><CreditCard size={18}/> Reopen Razorpay Checkout <ArrowRight size={17}/></button>}
          {stage === 'pending' && order && <button className="cx-checkout-main" onClick={() => void checkStatus()}><RefreshCw size={17}/> Check payment status</button>}
          {stage === 'order-pending' && order && <button className="cx-reference-action" onClick={() => void copyReference()}><ClipboardList size={16}/> Copy top-up reference for support</button>}
          <button className="btn btn-secondary" disabled={busy} onClick={onClose}>{stage === 'credited' ? 'Done' : 'Close'}</button>
        </div>
      </div>}
      <div className="cx-payment-footer"><ShieldCheck size={15}/><span>Your payment credentials are handled by Razorpay. This application never asks for your UPI PIN, card details or passwords.</span></div>
    </div>
  </Modal>;
}

/* ---------- support + updates ---------- */
function Support({ say }: Ctx) {
  const list = useApi(() => customerApi.tickets()); const [open, setOpen] = useState<string | null>(null); const [add, setAdd] = useState(false);
  return <section className="customer-section"><div className="customer-section-head"><div><h2>Support tickets</h2><p>Ask about an order, payment or your account.</p></div><button className="btn btn-primary btn-small" onClick={() => setAdd(true)}><Plus size={14} /> New ticket</button></div>
    {list.error ? <ModuleState error={list.error} hint="GET /api/v1/customer/support/tickets" onRetry={list.reload} /> : <div className="customer-order-list">{(list.data?.items ?? []).map(t => <button className="customer-order-row cx-btnrow" key={t.ticketNumber} onClick={() => setOpen(t.ticketNumber)}><div className="customer-order-icon"><LifeBuoy size={18} /></div><div className="customer-order-info"><strong>{t.subject}</strong><small>{t.ticketNumber} · {t.category} · {when(t.createdAt)}</small></div><Pill s={t.status} /></button>)}{list.data && !list.data.items.length && <div className="customer-empty">No tickets yet.</div>}</div>}
    {add && <NewTicket onClose={() => setAdd(false)} onDone={n => { setAdd(false); say(`Ticket ${n} created.`); list.reload(); }} />}{open && <Thread n={open} onClose={() => setOpen(null)} />}</section>;
}
function NewTicket({ onClose, onDone }: { onClose: () => void; onDone: (n: string) => void }) {
  const [f, setF] = useState({ subject: '', category: 'ORDER', message: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setErr(''); setBusy(true); try { onDone((await customerApi.createTicket(f)).ticketNumber); } catch (x) { setErr(x instanceof Error ? x.message : 'Could not create the ticket.'); } finally { setBusy(false); } };
  return <Modal title="New support ticket" onClose={onClose}><form className="form-stack" onSubmit={submit}>{err && <div className="form-error"><AlertTriangle size={15} />{err}</div>}
    <label className="modal-label">Category</label><select className="form-input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{['ORDER', 'PAYMENT', 'WALLET', 'ACCOUNT', 'OTHER'].map(c => <option key={c}>{c}</option>)}</select>
    <label className="modal-label">Subject</label><input className="form-input" maxLength={180} value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} required />
    <label className="modal-label">Message</label><textarea className="form-input cx-textarea" maxLength={4000} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} required />
    <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Create ticket'}</button></div></form></Modal>;
}
function Thread({ n, onClose }: { n: string; onClose: () => void }) {
  const d = useApi(() => customerApi.ticket(n)); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const send = async (e: FormEvent) => { e.preventDefault(); if (!msg.trim()) return; setBusy(true); try { await customerApi.replyTicket(n, msg.trim()); setMsg(''); d.reload(); } finally { setBusy(false); } };
  return <Modal title={d.data?.subject ?? `Ticket ${n}`} sub={n} onClose={onClose}>{d.error ? <ModuleState error={d.error} hint="GET /api/v1/customer/support/tickets/{ticketNumber}" /> : <>
    <div className="cx-thread">{(d.data?.messages ?? []).map((m, i) => <div key={i} className={`cx-msg ${m.senderType === 'CUSTOMER' ? 'me' : ''}`}><small>{m.senderType === 'CUSTOMER' ? 'You' : 'Support'} · {when(m.createdAt)}</small><p>{m.messageText}</p></div>)}</div>
    <form className="cx-reply" onSubmit={send}><input className="form-input" value={msg} onChange={e => setMsg(e.target.value)} placeholder="Write a reply…" maxLength={4000} /><button className="btn btn-primary" disabled={busy}>Send</button></form></>}</Modal>;
}
function Updates() {
  const a = useApi(() => customerApi.announcements());
  return <section className="customer-section"><div className="customer-section-head"><div><h2>Announcements</h2><p>News and notices from the team.</p></div></div>
    {a.error ? <ModuleState error={a.error} hint="GET /api/v1/customer/announcements" onRetry={a.reload} /> : <div className="customer-order-list">{(a.data ?? []).map(x => <div className="customer-order-row cx-note" key={x.id}><div className="customer-order-icon"><Bell size={18} /></div><div className="customer-order-info"><strong>{x.title}</strong><small>{when(x.publishedAt)}</small><p>{x.body}</p></div></div>)}{a.data && !a.data.length && <div className="customer-empty">No announcements right now.</div>}</div>}</section>;
}

/* ---------- profile ---------- */
function Profile({ onLogout }: { onLogout: () => void }) {
  const p = useApi<CustomerProfile>(() => customerApi.profile()); const [busy, setBusy] = useState(false);
  const all = useMemo(() => async () => { setBusy(true); try { await authApi.logoutAll(); } finally { onLogout(); } }, [onLogout]);
  if (p.error) return <ModuleState error={p.error} hint="GET /api/v1/customer/profile" onRetry={p.reload} />;
  if (!p.data) return <div className="customer-empty">Loading…</div>;
  const d = p.data;
  return <section className="customer-profile-card"><div className="customer-profile-head"><div className="customer-avatar customer-avatar-large">{initials(d.displayName)}</div><div><h2>{d.displayName}</h2><p>Customer account · {d.customerNumber ?? '—'}</p></div><Pill s={d.status} /></div>
    <div className="customer-profile-grid"><div><span>Mobile</span><strong>{d.phoneE164 ?? '—'}</strong></div><div><span>Phone verification</span><strong>{d.phoneVerified ? <><BadgeCheck size={15} /> Verified</> : 'Not verified'}</strong></div><div><span>Email</span><strong>{d.email ?? '—'}</strong></div><div><span>Member since</span><strong>{when(d.createdAt)}</strong></div></div>
    <div className="customer-profile-note"><LockKeyhole size={15} /> We never ask for social account passwords or OTPs.</div>
    <div className="cx-row"><button className="btn btn-secondary" disabled={busy} onClick={all}><LogOut size={14} /> Sign out of all devices</button></div></section>;
}
