import { useEffect, useState, type ReactNode, type Dispatch, type SetStateAction, type FormEvent } from 'react';
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight,
  BadgeCheck, Bell, BookOpen, Boxes, Briefcase, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3, Cloud,
  CreditCard, Download, ExternalLink, FileCheck2, Filter, Fingerprint, BarChart3,
  Globe, History, LayoutDashboard, LifeBuoy, LockKeyhole, LogOut, Menu,
  MoreHorizontal, Package, Plus, Search, Settings, Shield, ShieldAlert, ShieldCheck,
  Sparkles, Tag, Users, Wallet, X, RefreshCw, AlertTriangle, CircleDollarSign,
  ShoppingBag, House, UserRound, ArrowLeft,
} from 'lucide-react';
import { apiPaths, isDemoMode } from './api/config';
import { catalogApi } from './api/catalogApi';
import CatalogWorkspace from './catalog/CatalogWorkspace';
import CatalogSetupGuide from './catalog/CatalogSetupGuide';
import { AdminDashboardLive, AdminOrdersLive, AdminFinanceLive, AdminReportsLive, AdminCustomersLive, AdminAuditLive } from './admin/LiveOperations';
import PlatformIcon from './components/PlatformIcon';
import { apiRequest, setAccessToken, unwrap } from './api/http';
import {
  seedAudit, seedCategories, seedCustomers, seedLedger, seedOrders, seedPlatforms,
  seedServices, seedPriceVersions, seedServiceInputs, type Category, type Customer, type Order, type Platform, type Service, type PriceVersion, type ServiceInput,
} from './data/mock';

type PageKey = 'dashboard' | 'platforms' | 'categories' | 'services' | 'pricing' | 'inputs' | 'orders' | 'customers' | 'wallet' | 'policy' | 'reports' | 'audit' | 'settings';

// A real admin URL must select the matching workspace page after refresh or MFA login.
// Previously /admin/orders always mounted Overview because page state started at 'dashboard'.
const ADMIN_ROUTES: Record<PageKey, string> = {
  dashboard: '/admin', orders: '/admin/orders', wallet: '/admin/wallet', customers: '/admin/customers',
  platforms: '/admin/platforms', categories: '/admin/categories', services: '/admin/services',
  pricing: '/admin/pricing', inputs: '/admin/inputs', policy: '/admin/policy',
  reports: '/admin/reports', audit: '/admin/audit', settings: '/admin/settings',
};
function pageFromLocation(): PageKey {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return (Object.keys(ADMIN_ROUTES) as PageKey[]).find(k => ADMIN_ROUTES[k] === path) ?? 'dashboard';
}

type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null;
type CustomerPageKey = 'home' | 'catalog' | 'orders' | 'wallet' | 'profile';
type AdminLoginChallenge = { challengeToken: string; expiresInSeconds: number; message?: string };

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const persist = <T,>(key: string, fallback: T): T => {
  if (!isDemoMode) return fallback;
  try { const value = localStorage.getItem(`smm-demo-${key}`); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
};
const saveDemo = <T,>(key: string, value: T) => { if (isDemoMode) localStorage.setItem(`smm-demo-${key}`, JSON.stringify(value)); };

const pageMeta: Record<PageKey, { title: string; description: string }> = {
  dashboard: { title: 'Overview', description: 'Your platform at a glance. Here is what is happening today.' },
  platforms: { title: 'Platforms', description: 'Manage the social channels supported by your service catalog.' },
  categories: { title: 'Categories', description: 'Organise your catalog into clear, customer-friendly service groups.' },
  services: { title: 'Services', description: 'Create, review and publish compliant social media services.' },
  pricing: { title: 'Pricing & versions', description: 'Publish immutable price versions with clear INR units and effective dates.' },
  inputs: { title: 'Service inputs', description: 'Define the safe information customers must provide for each service.' },
  orders: { title: 'Order Management', description: 'Review customer orders, manage fulfilment and track wallet reservations.' },
  customers: { title: 'Customers', description: 'View customer accounts, activity and verification status.' },
  wallet: { title: 'Wallet & payments', description: 'Monitor verified payments and the double-entry wallet ledger.' },
  policy: { title: 'Policy review', description: 'Review service descriptions and ensure every offer follows platform rules.' },
  reports: { title: 'Reports', description: 'Track revenue, fulfilment, customer activity and catalog performance.' },
  audit: { title: 'Audit log', description: 'A traceable record of sensitive administrative activity.' },
  settings: { title: 'Settings & security', description: 'Manage admin security, API connectivity and platform preferences.' },
};

function App() {
  const [page, setPage] = useState<PageKey>(() => pageFromLocation());
  const [portalMode, setPortalMode] = useState<'admin' | 'customer'>('admin');
  const [customerPage, setCustomerPage] = useState<CustomerPageKey>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(isDemoMode);
  const [authReady, setAuthReady] = useState(isDemoMode);
  const [adminName, setAdminName] = useState('Super Admin');
  const [notice, setNotice] = useState<Notice>(null);
  const [search, setSearch] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>(() => isDemoMode ? persist('platforms', seedPlatforms) : []);
  const [categories, setCategories] = useState<Category[]>(() => isDemoMode ? persist('categories', seedCategories) : []);
  const [services, setServices] = useState<Service[]>(() => isDemoMode ? persist('services', seedServices) : []);
  const [priceVersions, setPriceVersions] = useState<PriceVersion[]>(() => isDemoMode ? persist('priceVersions', seedPriceVersions) : []);
  const [serviceInputs, setServiceInputs] = useState<ServiceInput[]>(() => isDemoMode ? persist('serviceInputs', seedServiceInputs) : []);
  const [orders, setOrders] = useState<Order[]>(() => isDemoMode ? persist('orders', seedOrders) : []);
  const [customers, setCustomers] = useState<Customer[]>(() => isDemoMode ? persist('customers', seedCustomers) : []);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [adminRefreshTick, setAdminRefreshTick] = useState(0);

  useEffect(() => {
    if (!authenticated || isDemoMode) return;
    let alive = true;
    Promise.all([catalogApi.platforms(), catalogApi.categories(), catalogApi.services()]).then(([p, c, svc]) => {
      if (!alive) return;
      setPlatforms(p.map(item => ({...item, accent: '#7664d6', initials: item.name.slice(0,2).toUpperCase() })));
      setCategories(c.map(item => ({id: item.id, name: item.name, slug: item.slug,
        platform: p.find(platform => platform.id === item.platformId)?.name || 'All platforms',
        status: item.status, services: svc.filter(s => s.categoryId === item.id).length, updated: item.updatedAt })));
      setServices(svc.map(item => ({id: item.id, code: item.serviceCode, name: item.name,
        platform: p.find(platform => platform.id === item.platformId)?.name || 'All platforms',
        category: c.find(category => category.id === item.categoryId)?.name || 'Uncategorised',
        fulfilment: 'MANUAL' as const, policyStatus: item.policyStatus === 'REJECTED' ? 'SUSPENDED' : item.policyStatus,
        status: item.status === 'RETIRED' ? 'PAUSED' : item.status, price: 0, unit: 'See price versions', updated: item.updatedAt })));
    }).catch(err => { if (alive) setNotice({kind:'error', text: `Unable to load live catalogue: ${err instanceof Error ? err.message : 'Request failed'}`}); });
    return () => { alive = false; };
  }, [authenticated, catalogRevision]);

  useEffect(() => {
    if (isDemoMode) return;
    apiRequest<any>(apiPaths.adminRefresh, { method: 'POST' })
      .then((response) => {
        const data = unwrap<any>(response);
        const token = data?.accessToken || data?.access_token || data?.token;
        if (token) { setAccessToken(token); setAuthenticated(true); setAdminName(data?.displayName || 'Super Admin'); }
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => { saveDemo('platforms', platforms); }, [platforms]);
  useEffect(() => { saveDemo('categories', categories); }, [categories]);
  useEffect(() => { saveDemo('services', services); }, [services]);
  useEffect(() => { saveDemo('priceVersions', priceVersions); }, [priceVersions]);
  useEffect(() => { saveDemo('serviceInputs', serviceInputs); }, [serviceInputs]);
  useEffect(() => { saveDemo('orders', orders); }, [orders]);
  useEffect(() => { saveDemo('customers', customers); }, [customers]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 4200); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setSearch(''); setGlobalSearchOpen(true);
      }
      if (event.key === 'Escape') setGlobalSearchOpen(false);
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  /** First factor: password only. The backend returns a short-lived MFA challenge, never an API token. */
  async function beginAdminLogin(phone: string, password: string): Promise<AdminLoginChallenge | null> {
    if (isDemoMode) {
      if (!phone.trim() || !password.trim()) throw new Error('Enter the demo admin phone and password.');
      setAdminName('Demo Super Admin'); setAuthenticated(true); setPage(pageFromLocation()); return null;
    }

    const digits = phone.replace(/\D/g, '');
    const phoneE164 = phone.trim().startsWith('+') ? `+${digits}` : `+91${digits}`;
    if (!/^\+[1-9][0-9]{7,14}$/.test(phoneE164)) {
      throw new Error('Enter a valid administrator phone number with country code.');
    }

    const response = await apiRequest<any>(apiPaths.adminLogin, {
      method: 'POST',
      body: JSON.stringify({ phoneE164, password }),
    });
    const data = unwrap<any>(response);
    if (!data?.challengeToken || data?.mfaRequired !== true) {
      throw new Error(data?.message || 'The server did not return an MFA challenge. Check the Super Admin login API.');
    }
    return {
      challengeToken: String(data.challengeToken),
      expiresInSeconds: Number(data.expiresInSeconds || 300),
      message: data.message,
    };
  }

  /** Second factor: only a verified MFA response can establish the Super Admin session. */
  async function verifyAdminMfa(challengeToken: string, code: string) {
    if (isDemoMode) return;
    const response = await apiRequest<any>(apiPaths.adminMfaVerify, {
      method: 'POST',
      body: JSON.stringify({ challengeToken, code: code.trim() }),
    });
    const data = unwrap<any>(response);
    const token = data?.accessToken || data?.access_token || data?.token;
    if (!token) throw new Error('MFA verification succeeded without an access token. Check the admin MFA response.');
    setAccessToken(token);
    setAdminName(data?.displayName || 'Super Admin');
    setAuthenticated(true);
    setPage(pageFromLocation());
  }

  async function logout() {
    try { if (!isDemoMode) await apiRequest(apiPaths.adminLogout, { method: 'POST' }); }
    catch { /* clear the local session even if the server is unavailable */ }
    setAccessToken(null); setAuthenticated(false); setProfileOpen(false); setPortalMode('admin');
  }

  const navigate = (next: PageKey) => {
    setPage(next); setSidebarOpen(false); setSearch('');
    const target = ADMIN_ROUTES[next];
    if (window.location.pathname !== target) window.history.pushState({}, '', target);
  };
  // Support browser back/forward and direct /admin/orders bookmarks.
  useEffect(() => {
    const onPopState = () => { setPage(pageFromLocation()); setSidebarOpen(false); };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (!authReady) return <div className="splash"><div className="brand-mark"><Sparkles size={22} /></div><span>Connecting to SMM Platform…</span></div>;
  if (!authenticated) return <LoginScreen onPasswordLogin={beginAdminLogin} onMfaVerify={verifyAdminMfa} />;
  if (portalMode === 'customer') return <CustomerPortal categories={categories} services={services} orders={orders} setOrders={setOrders} customerPage={customerPage} setCustomerPage={setCustomerPage} onBackAdmin={() => { setPortalMode('admin'); setPage('dashboard'); }} />;

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={21} strokeWidth={2.2} /></div>
          <div><div className="brand-name">social<span>suite</span></div><div className="brand-sub">ADMIN CONSOLE</div></div>
          <button className="sidebar-close icon-button" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <div className="workspace-switch"><div className="workspace-avatar">S</div><div className="workspace-copy"><strong>SMM Platform</strong><span>Workspace · India</span></div><ChevronDown size={15} /></div>
        <nav className="main-nav">
          <div className="nav-label">WORKSPACE</div>
          <NavItem active={page === 'dashboard'} icon={<LayoutDashboard size={18} />} label="Overview" onClick={() => navigate('dashboard')} />
          <NavItem active={page === 'orders'} icon={<ClipboardList size={18} />} label="Order Management" onClick={() => navigate('orders')} count={orders.filter(o => o.status === 'PENDING').length || undefined} />
          <NavItem active={page === 'wallet'} icon={<Wallet size={18} />} label="Wallet & payments" onClick={() => navigate('wallet')} />
          <div className="nav-label nav-label-spaced">CATALOG</div>
          <NavItem active={page === 'platforms'} icon={<Globe size={18} />} label="Platforms" onClick={() => navigate('platforms')} />
          <NavItem active={page === 'categories'} icon={<Boxes size={18} />} label="Categories" onClick={() => navigate('categories')} />
          <NavItem active={page === 'services'} icon={<Package size={18} />} label="Services" onClick={() => navigate('services')} count={services.filter(s => s.policyStatus === 'REVIEW_REQUIRED').length || undefined} />
          <NavItem active={page === 'pricing'} icon={<CircleDollarSign size={18} />} label="Pricing & versions" onClick={() => navigate('pricing')} />
          <NavItem active={page === 'inputs'} icon={<ClipboardList size={18} />} label="Service inputs" onClick={() => navigate('inputs')} />
          <div className="nav-label nav-label-spaced">OPERATIONS</div>
          <NavItem active={page === 'customers'} icon={<Users size={18} />} label="Customers" onClick={() => navigate('customers')} />
          <NavItem active={page === 'policy'} icon={<ShieldCheck size={18} />} label="Policy review" onClick={() => navigate('policy')} count={services.filter(s => s.policyStatus === 'REVIEW_REQUIRED').length || undefined} />
          <div className="nav-label nav-label-spaced">INSIGHTS</div>
          <NavItem active={page === 'reports'} icon={<BarChart3 size={18} />} label="Reports" onClick={() => navigate('reports')} />
          <NavItem active={page === 'audit'} icon={<History size={18} />} label="Audit log" onClick={() => navigate('audit')} />
        </nav>
        <div className="sidebar-bottom">
          {isDemoMode && <button className="customer-preview-nav" onClick={() => { setPortalMode('customer'); setCustomerPage('home'); }}><div className="customer-preview-icon"><ShoppingBag size={16} /></div><span><strong>Customer portal</strong><small>Switch to customer panel</small></span><ArrowRight size={15} /></button>}
          <div className="help-card"><div className="help-icon"><LifeBuoy size={17} /></div><strong>Need a hand?</strong><p>Explore the admin guide to get more from your workspace.</p><button disabled title="Help centre has not been published">Help centre coming soon <ArrowRight size={14} /></button></div>
          <NavItem active={page === 'settings'} icon={<Settings size={18} />} label="Settings & security" onClick={() => navigate('settings')} />
          <div className="sidebar-footer"><span className="online-dot" /> All systems operational <span className="version">v1.0.0</span></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{pageMeta[page].title}</strong></div></div>
          <div className="topbar-right">
            {isDemoMode && <span className="demo-chip"><span /> DEMO MODE</span>}
            {isDemoMode && <div className="demo-role-switcher"><span>PREVIEW</span><button className="role-active" onClick={() => setPortalMode('admin')}>Admin</button><button onClick={() => { setPortalMode('customer'); setCustomerPage('home'); }}>Customer</button></div>}
            <button type="button" className={`admin-orders-shortcut ${page === 'orders' ? 'is-current' : ''}`} aria-current={page === 'orders' ? 'page' : undefined} onClick={() => navigate('orders')}><ClipboardList size={16} /><span>Order Management</span></button>
            <button className="search-trigger" onClick={() => { setSearch(''); setGlobalSearchOpen(true); }}><Search size={16} /><span>Search anything...</span><kbd>⌘ K</kbd></button>
            <button className="icon-button notification-button" aria-label="Review orders" onClick={() => navigate('orders')}><Bell size={19} /><i /></button>
            <div className="profile-wrap">
              <button className="profile-button" onClick={() => setProfileOpen(!profileOpen)}><div className="avatar">SA</div><div className="profile-copy"><strong>{adminName}</strong><span>Super Admin</span></div><ChevronDown size={15} /></button>
              {profileOpen && <div className="profile-menu"><div className="profile-menu-head"><div className="avatar">SA</div><div><strong>{adminName}</strong><span>Super Admin access</span></div></div><button onClick={() => { navigate('settings'); setProfileOpen(false); }}><Shield size={16} /> Security settings</button><button className="danger-menu" onClick={logout}><LogOut size={16} /> Sign out</button></div>}
            </div>
          </div>
        </header>

        <div className="page-wrap">
          <div className="page-heading"><div><div className="eyebrow">SMM PLATFORM <span>/</span> ADMIN</div><h1>{pageMeta[page].title}</h1><p>{pageMeta[page].description}</p></div><div className="heading-actions"><button className="btn btn-secondary" onClick={() => {setAdminRefreshTick(t=>t+1);setCatalogRevision(t=>t+1);}}><RefreshCw size={15} /> Refresh</button>{isDemoMode && page === 'categories' && <button className="btn btn-primary" onClick={() => { setPortalMode('customer'); setCustomerPage('catalog'); }}><ShoppingBag size={15} /> Preview in customer panel</button>}{isDemoMode && page === 'services' && <button className="btn btn-primary" onClick={() => navigate('categories')}><Plus size={16} /> Manage catalog</button>}</div></div>
          {notice && <div className={`notice notice-${notice.kind}`}><span>{notice.kind === 'success' ? <CheckCircle2 size={17} /> : notice.kind === 'error' ? <AlertTriangle size={17} /> : <CircleHelp size={17} />}</span>{notice.text}<button onClick={() => setNotice(null)}><X size={16} /></button></div>}
          {isDemoMode && ['platforms','categories','services','inputs','pricing','policy'].includes(page) && <CatalogSetupGuide section={page as 'platforms' | 'categories' | 'services' | 'inputs' | 'pricing' | 'policy'} platformsCount={platforms.length} categoriesCount={categories.length} servicesCount={services.length} onNavigate={next => navigate(next)}/>}
          {page === 'dashboard' && <div className="admin-start-guide"><div><span>START HERE · CATALOGUE SETUP</span><strong>Need to publish a new service?</strong><p>Create a Platform → Category → Service → Customer Inputs → Pricing → Policy Review, then activate it.</p></div><button onClick={() => navigate('platforms')}>Open guided setup <ArrowRight size={16}/></button></div>}
          {page === 'dashboard' && (isDemoMode ? <Dashboard platforms={platforms} categories={categories} services={services} orders={orders} customers={customers} navigate={navigate} /> : <AdminDashboardLive refreshKey={adminRefreshTick} navigate={navigate} />)}
          {page === 'platforms' && (isDemoMode ? <PlatformsPage platforms={platforms} setPlatforms={setPlatforms} /> : <CatalogWorkspace section="platforms" onNavigate={next => navigate(next)} onChanged={() => setCatalogRevision(n=>n+1)}/>)}
          {page === 'categories' && (isDemoMode ? <CategoriesPage categories={categories} setCategories={setCategories} platforms={platforms} /> : <CatalogWorkspace section="categories" onNavigate={next => navigate(next)} onChanged={() => setCatalogRevision(n=>n+1)}/>)}
          {page === 'services' && (isDemoMode ? <ServicesPage services={services} setServices={setServices} categories={categories} /> : <CatalogWorkspace section="services" onNavigate={next => navigate(next)} onChanged={() => setCatalogRevision(n=>n+1)}/>)}
          {page === 'pricing' && (isDemoMode ? <PricingPage services={services} priceVersions={priceVersions} setPriceVersions={setPriceVersions} /> : <CatalogWorkspace section="pricing" onNavigate={next => navigate(next)} onChanged={() => setCatalogRevision(n=>n+1)}/>)}
          {page === 'inputs' && (isDemoMode ? <ServiceInputsPage services={services} serviceInputs={serviceInputs} setServiceInputs={setServiceInputs} /> : <CatalogWorkspace section="inputs" onNavigate={next => navigate(next)} onChanged={() => setCatalogRevision(n=>n+1)}/>)}
          {page === 'orders' && (isDemoMode ? <OrdersPage orders={orders} setOrders={setOrders} /> : <AdminOrdersLive refreshKey={adminRefreshTick} />)}
          {page === 'customers' && (isDemoMode ? <CustomersPage customers={customers} /> : <AdminCustomersLive refreshKey={adminRefreshTick} />)}
          {page === 'wallet' && (isDemoMode ? <WalletPage /> : <AdminFinanceLive refreshKey={adminRefreshTick} />)}
          {page === 'policy' && (isDemoMode ? <PolicyPage services={services} setServices={setServices} /> : <CatalogWorkspace section="policy" onNavigate={next => navigate(next)} onChanged={() => setCatalogRevision(n=>n+1)}/>)}
          {page === 'reports' && (isDemoMode ? <ReportsPage orders={orders} customers={customers} /> : <AdminReportsLive refreshKey={adminRefreshTick} />)}
          {page === 'audit' && (isDemoMode ? <AuditPage /> : <AdminAuditLive refreshKey={adminRefreshTick} />)}
          {page === 'settings' && <SettingsPage onNotice={setNotice} />}
          <footer className="page-footer"><span>© 2026 SMM Platform</span><span><span className="online-dot" /> Secure admin workspace</span><span>Built for compliant social growth</span></footer>
        </div>
        {globalSearchOpen && <GlobalSearchModal query={search} setQuery={setSearch} onClose={() => setGlobalSearchOpen(false)} onNavigate={(target) => { navigate(target); setGlobalSearchOpen(false); }} platforms={platforms} categories={categories} services={services} orders={orders} customers={customers} />}
      </main>
    </div>
  );
}

function CustomerPortal({ categories, services, orders, setOrders, customerPage, setCustomerPage, onBackAdmin }: {
  categories: Category[]; services: Service[]; orders: Order[]; setOrders: Dispatch<SetStateAction<Order[]>>;
  customerPage: CustomerPageKey; setCustomerPage: Dispatch<SetStateAction<CustomerPageKey>>; onBackAdmin: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState('All categories');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const visibleCategories = categories.filter(c => c.status === 'ACTIVE');
  const visibleServices = services.filter(s => s.status === 'ACTIVE' && s.policyStatus === 'APPROVED');
  const filteredServices = visibleServices.filter(s => (selectedCategory === 'All categories' || s.category === selectedCategory) && `${s.name} ${s.category} ${s.platform}`.toLowerCase().includes(query.toLowerCase()));
  const myOrders = orders.filter(o => o.customer === 'Meera Reddy' || o.customer === 'Demo Customer');
  const pageTitle: Record<CustomerPageKey, string> = { home: 'Our services', catalog: 'Explore services', orders: 'My orders', wallet: 'My wallet', profile: 'My profile' };

  function placeDemoOrder(service: Service) {
    const nextId = Math.max(2841, ...orders.map(o => Number(o.id.replace(/\D/g, '')) || 0)) + 1;
    setOrders(prev => [{ id: `SMM-${nextId}`, customer: 'Meera Reddy', service: service.name, platform: service.platform, quantity: 1, amount: service.price, status: 'PENDING', date: 'Demo order · Just now' }, ...prev]);
    setToast(`Demo order request created for ${service.name}.`);
    window.setTimeout(() => setToast(''), 4000);
    setCustomerPage('orders');
  }

  return <div className="customer-shell">
    <header className="customer-topbar">
      <div className="customer-brand"><div className="customer-brand-mark"><Sparkles size={20} /></div><div><strong>social<span>suite</span></strong><small>CUSTOMER PORTAL</small></div></div>
      <div className="customer-topbar-center"><span className="customer-live-dot" /> Signed in as <strong>Meera Reddy</strong><span className="customer-demo-label">DEMO CUSTOMER</span></div>
      <div className="customer-topbar-actions"><div className="demo-role-switcher customer-role-switcher"><span>PREVIEW</span><button onClick={onBackAdmin}><ArrowLeft size={12} /> Admin</button><button className="role-active"><UserRound size={12} /> Customer</button></div><div className="customer-avatar">MR</div></div>
    </header>
    <div className="customer-layout">
      <aside className="customer-sidebar">
        <div className="customer-side-welcome"><div className="customer-avatar customer-avatar-large">MR</div><div><strong>Meera Reddy</strong><span>Customer account</span></div></div>
        <div className="customer-nav-label">MY SPACE</div>
        <button className={customerPage === 'home' ? 'customer-nav-item active' : 'customer-nav-item'} onClick={() => setCustomerPage('home')}><House size={17} /> Discover</button>
        <button className={customerPage === 'catalog' ? 'customer-nav-item active' : 'customer-nav-item'} onClick={() => { setCustomerPage('catalog'); setSelectedCategory('All categories'); }}><Boxes size={17} /> Browse categories</button>
        <button className={customerPage === 'orders' ? 'customer-nav-item active' : 'customer-nav-item'} onClick={() => setCustomerPage('orders')}><ClipboardList size={17} /> My orders <em>{myOrders.length}</em></button>
        <button className={customerPage === 'wallet' ? 'customer-nav-item active' : 'customer-nav-item'} onClick={() => setCustomerPage('wallet')}><Wallet size={17} /> Wallet</button>
        <button className={customerPage === 'profile' ? 'customer-nav-item active' : 'customer-nav-item'} onClick={() => setCustomerPage('profile')}><UserRound size={17} /> Profile</button>
        <div className="customer-help-card"><ShieldCheck size={18} /><strong>Work with confidence</strong><p>Transparent services, clear pricing and human-reviewed delivery.</p></div>
        <button className="customer-back-admin" onClick={onBackAdmin}><ArrowLeft size={15} /> Return to Admin Panel</button>
      </aside>
      <main className="customer-main">
        <div className={`customer-page-heading ${customerPage === 'home' ? 'cx-home-page-heading' : ''}`}><div><div className="eyebrow">SMM PLATFORM <span>/</span> CUSTOMER</div><h1>{pageTitle[customerPage]}</h1><p>Discover professional social media services and track your work in one place.</p></div><div className="customer-heading-pill"><span className="customer-live-dot" /> Customer session active</div></div>
        <div className="customer-demo-notice"><Sparkles size={15} /><span><strong>Customer demo preview</strong> — this panel uses sample data and local interactions. Live mode uses Phase 4 backend APIs; this preview uses sample data.</span></div>
        {toast && <div className="notice notice-success customer-toast"><CheckCircle2 size={16} />{toast}</div>}

        {customerPage === 'home' && <div className="cx-home-v4">
          <section className="cx-promo-banner"><div className="cx-promo-copy"><span className="cx-promo-kicker"><Sparkles size={14}/> DISCOVER WHAT'S AVAILABLE</span><h2>Discover services that move your ideas forward.</h2><p>Explore approved marketing and creative support. Clear pricing, clear deliverables, human-managed work.</p><button onClick={()=>setCustomerPage('catalog')}>Browse all services <ArrowRight size={16}/></button></div><div className="cx-promo-side"><span>DISCOVER · PLAN · DELIVER</span><div className="cx-promo-shape"><Sparkles size={41}/></div></div></section>
          <div className="cx-home-slim-stats"><button onClick={()=>setCustomerPage('wallet')}><Wallet size={16}/><strong>Wallet preview</strong><span>Sample balance</span><ArrowRight size={14}/></button><button onClick={()=>setCustomerPage('orders')}><ClipboardList size={16}/><strong>{myOrders.length} orders</strong><span>Order history</span><ArrowRight size={14}/></button><button onClick={()=>setCustomerPage('catalog')}><LayoutDashboard size={16}/><strong>{visibleServices.length} services</strong><span>Browse catalogue</span><ArrowRight size={14}/></button></div>
          <section className="cx-home-service-section"><div className="cx-home-section-title"><div><span className="cx-promo-kicker">OUR SERVICES · DEMO</span><h2>Explore what we offer</h2><p>Hover over any card to pause the rail.</p></div><button className="cx-view-all" onClick={()=>setCustomerPage('catalog')}>View all <ArrowRight size={15}/></button></div>
            {visibleServices.length>0?<div className="cx-service-viewport" role="region" tabIndex={0} aria-label="Sample services"><div className="cx-service-marquee">{[0,1].map(copy=><div className="cx-service-marquee-group" key={copy} aria-hidden={copy===1}>{visibleServices.map(item=><article className="cx-service-marquee-card" key={`${copy}-${item.id}`}><div className="cx-marquee-card-icon"><PlatformIcon code={item.platform} size={27}/><span>APPROVED</span></div><small>{item.category}</small><h3>{item.name}</h3><p>Human-managed project support with transparent scope and status tracking.</p><div className="cx-marquee-card-foot"><div><strong>{money(item.price)}</strong><small>{item.unit}</small></div><button tabIndex={copy===1?-1:0} aria-label={`Request ${item.name}`} onClick={()=>placeDemoOrder(item)}><ArrowRight size={16}/></button></div></article>)}</div>)}</div></div>:<div className="customer-empty">No services published in the sample catalog.</div>}
          </section>
          <section className="cx-home-wallet-rail"><div className="cx-home-wallet-mark"><ShieldCheck size={21}/></div><div><strong>Make your next project simple.</strong><p>Browse categories and send a sample request in demo mode. Live mode creates verified quotes.</p></div><button onClick={()=>setCustomerPage('catalog')}>Explore services <ArrowRight size={15}/></button></section>
        </div>}

        {customerPage === 'catalog' && <section className="customer-section customer-catalog-section"><div className="customer-filter-row"><div className="customer-category-filters"><button className={selectedCategory === 'All categories' ? 'selected' : ''} onClick={() => setSelectedCategory('All categories')}>All categories</button>{visibleCategories.map(c => <button key={c.id} className={selectedCategory === c.name ? 'selected' : ''} onClick={() => setSelectedCategory(c.name)}>{c.name}</button>)}</div><div className="customer-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search services..." /></div></div><div className="customer-service-grid">{filteredServices.map(service => <CustomerServiceCard key={service.id} service={service} onOrder={placeDemoOrder} />)}{!filteredServices.length && <div className="customer-empty">No approved services are available in this category yet.</div>}</div></section>}

        {customerPage === 'orders' && <section className="customer-section"><div className="customer-section-head"><div><h2>Order history</h2><p>Track the status of your service requests.</p></div><span className="customer-small-tag">{myOrders.length} orders</span></div><div className="customer-order-list">{myOrders.map(order => <div className="customer-order-row" key={order.id}><div className="customer-order-icon"><ShoppingBag size={18} /></div><div className="customer-order-info"><strong>{order.service}</strong><small>{order.id} · {order.platform} · {order.date}</small></div><strong className="customer-order-price">{money(order.amount)}</strong><StatusPill status={order.status} /></div>)}{!myOrders.length && <div className="customer-empty">You haven't placed any orders yet.</div>}</div></section>}

        {customerPage === 'wallet' && <section className="customer-wallet-layout"><div className="customer-wallet-card"><span>AVAILABLE BALANCE</span><strong>₹2,500.00</strong><small>Prepaid wallet · demo balance</small><div className="customer-wallet-card-foot"><ShieldCheck size={16} /> Wallet activity is recorded in a ledger</div></div><div className="customer-wallet-info"><h2>Wallet & payments</h2><p>Your prepaid balance is available for purchasing services on this platform. Payment verification will be handled by the backend and bank/acquirer integration.</p><div className="customer-payment-line"><span>Last sample payment</span><strong>₹2,500 · Verified</strong></div><small className="muted-cell">This is illustrative demo information, not a real payment or wallet balance.</small></div></section>}

        {customerPage === 'profile' && <section className="customer-profile-card"><div className="customer-profile-head"><div className="customer-avatar customer-avatar-large">MR</div><div><h2>Meera Reddy</h2><p>Customer account · CUS-1093</p></div><StatusPill status="ACTIVE" /></div><div className="customer-profile-grid"><div><span>Registered email</span><strong>meera@example.com</strong></div><div><span>Phone verification</span><strong><BadgeCheck size={15} /> Verified</strong></div><div><span>Member since</span><strong>October 18, 2026</strong></div><div><span>Account status</span><strong>Active</strong></div></div><div className="customer-profile-note"><LockKeyhole size={15} /> Your account security is managed through the platform's secure sign-in process. We never ask for social account passwords or OTPs.</div></section>}
        <footer className="customer-footer"><span>© 2026 SMM Platform</span><span>Responsible social growth · Built for customers</span><button onClick={onBackAdmin}>Switch to Admin demo <ArrowRight size={13} /></button></footer>
      </main>
    </div>
  </div>;
}

function CustomerServiceCard({ service, onOrder }: { service: Service; onOrder: (service: Service) => void }) {
  return <article className="customer-service-card"><div className="customer-service-card-top"><span><Sparkles size={15} /></span><StatusPill status="APPROVED" /></div><div className="customer-service-platform">{service.platform}</div><h3>{service.name}</h3><p>Professional support delivered by a human team, with clear scope and practical outcomes.</p><div className="customer-service-card-foot"><div><strong>{money(service.price)}</strong><small>{service.unit}</small></div><button onClick={() => onOrder(service)}>Request service <ArrowRight size={14} /></button></div></article>;
}

function NavItem({ active, icon, label, onClick, count }: { active: boolean; icon: ReactNode; label: string; onClick: () => void; count?: number }) {
  return <button className={`nav-item ${active ? 'nav-active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{count ? <em>{count}</em> : null}</button>;
}

function LoginScreen({
  onPasswordLogin,
  onMfaVerify,
}: {
  onPasswordLogin: (phone: string, password: string) => Promise<AdminLoginChallenge | null>;
  onMfaVerify: (challengeToken: string, code: string) => Promise<void>;
}) {
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [challenge, setChallenge] = useState<AdminLoginChallenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await onPasswordLogin(phone, password);
      if (result) {
        setChallenge(result);
        setPassword('');
        setCode('');
        setRecovery(false);
        setStep('mfa');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Super Admin sign-in.');
    } finally {
      setLoading(false);
    }
  }

  async function submitMfa(e: FormEvent) {
    e.preventDefault();
    setError('');
    const enteredCode = code.trim();
    if (!challenge?.challengeToken) {
      setError('Your sign-in challenge is missing. Return to sign-in and try again.');
      return;
    }
    if (recovery ? enteredCode.length < 6 || enteredCode.length > 64 : !/^[0-9]{6}$/.test(enteredCode)) {
      setError(recovery ? 'Enter a valid unused recovery code.' : 'Enter the 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    try {
      await onMfaVerify(challenge.challengeToken, enteredCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA verification failed.');
    } finally {
      setLoading(false);
    }
  }

  function backToCredentials() {
    setChallenge(null);
    setCode('');
    setRecovery(false);
    setError('');
    setStep('credentials');
  }

  return <div className="login-shell">
    <div className="login-left">
      <div className="login-brand"><div className="brand-mark"><Sparkles size={21} /></div><div className="brand-name">social<span>suite</span></div></div>
      <div className="login-art">
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-center"><Sparkles size={36} /></div>
        <div className="floating-card floating-card-a"><Activity size={16} /><span>Campaign performance</span><strong>+28.4%</strong></div>
        <div className="floating-card floating-card-b"><ShieldCheck size={17} /><span>Workspace protected</span><strong>Secure</strong></div>
      </div>
      <div className="login-left-copy"><div className="eyebrow">ONE WORKSPACE. CLEARER GROWTH.</div><h1>Good work deserves<br /><span>great management.</span></h1><p>Plan, deliver and measure social media services from one thoughtful workspace.</p></div>
      <div className="login-foot">© 2026 SMM Platform <span>·</span> Built for responsible social growth</div>
    </div>
    <div className="login-right">
      <form className="login-form" onSubmit={step === 'credentials' ? submitCredentials : submitMfa}>
        <div className="login-form-top"><span className="eyebrow">SUPER ADMIN ACCESS</span><span className="secure-label"><LockKeyhole size={13} /> SECURE SIGN IN</span></div>
        {step === 'credentials' ? <>
          <h2>Welcome back</h2>
          <p className="login-subtitle">Sign in to your Super Admin workspace.</p>
          {isDemoMode && <div className="demo-login-note"><Sparkles size={15} /><span>Demo mode is enabled. Use any non-empty phone and password to preview the admin console. MFA is skipped in demo mode.</span></div>}
          {error && <div className="form-error"><AlertTriangle size={15} />{error}</div>}
          <label>Phone number</label>
          <div className="input-wrap"><span className="input-prefix">+91</span><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter registered phone number" autoComplete="username" inputMode="tel" required /></div>
          <label>Password</label>
          <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
          <button type="submit" className="btn btn-primary login-submit" disabled={loading}>{loading ? 'Checking credentials…' : 'Continue securely'} <ArrowRight size={17} /></button>
          <div className="login-security"><ShieldCheck size={16} /><span>Your password is verified first. An authenticator challenge is required before an admin session is issued.</span></div>
        </> : <>
          <button type="button" className="text-button" onClick={backToCredentials} disabled={loading}><ArrowLeft size={14} /> Back to sign in</button>
          <h2>Verify it’s you</h2>
          <p className="login-subtitle">Your password was accepted. Complete the second verification step to access the Super Admin workspace.</p>
          <div className="demo-login-note"><ShieldCheck size={15} /><span>{challenge?.message || `Your verification challenge is valid for about ${Math.max(1, Math.ceil((challenge?.expiresInSeconds || 300) / 60))} minutes.`}</span></div>
          {error && <div className="form-error"><AlertTriangle size={15} />{error}</div>}
          <div className="label-row"><label>{recovery ? 'Recovery code' : 'Authenticator code'}</label><button type="button" className="text-button" onClick={() => { setRecovery(!recovery); setCode(''); setError(''); }}>{recovery ? 'Use authenticator app' : 'Use a recovery code'}</button></div>
          <input className="form-input code-input" type="text" value={code} onChange={e => setCode(e.target.value)} placeholder={recovery ? 'Enter one unused recovery code' : '6-digit code from your app'} inputMode={recovery ? 'text' : 'numeric'} autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} required />
          <button type="submit" className="btn btn-primary login-submit" disabled={loading}>{loading ? 'Verifying…' : 'Verify & enter workspace'} <ArrowRight size={17} /></button>
          <div className="login-security"><ShieldCheck size={16} /><span>{recovery ? 'Recovery codes are single-use. A code is consumed only after successful verification.' : 'Authenticator codes are time-based and expire frequently. Check your device clock if a code is rejected.'}</span></div>
        </>}
      </form>
      <div className="login-right-foot">Having trouble accessing your account? Contact your platform owner.</div>
    </div>
  </div>;
}

function Dashboard({ platforms, categories, services, orders, customers, navigate }: { platforms: Platform[]; categories: Category[]; services: Service[]; orders: Order[]; customers: Customer[]; navigate: (p: PageKey) => void }) {
  const pending = orders.filter(o => o.status === 'PENDING').length;
  const activeServices = services.filter(s => s.status === 'ACTIVE' && s.policyStatus === 'APPROVED').length;
  return <>
    <div className="welcome-banner"><div className="welcome-copy"><div className="welcome-tag"><Sparkles size={14} /> YOUR WORKSPACE, IN FOCUS</div><h2>Build trust. Deliver <span>real value.</span></h2><p>Keep your catalog transparent, your fulfilment on track and your customers in the loop.</p><button className="btn btn-light" onClick={() => navigate('services')}>Explore services <ArrowRight size={15} /></button></div><div className="welcome-graphic"><div className="graphic-ring ring-a" /><div className="graphic-ring ring-b" /><div className="graphic-core"><Sparkles size={30} /></div><div className="graphic-mini mini-a"><Check size={15} /></div><div className="graphic-mini mini-b"><Activity size={15} /></div><div className="graphic-mini mini-c"><ShieldCheck size={15} /></div></div><div className="welcome-corner">SMM / 2026</div></div>
    <div className="stat-grid"><StatCard label="Total orders" value={isDemoMode ? "2,841" : "—"} delta={isDemoMode ? "12.8%" : "Live API pending"} trend={isDemoMode ? "up" : "neutral"} icon={<ClipboardList size={19} />} tone="violet" sub={isDemoMode ? "vs. previous 30 days" : "Live analytics pending"} /><StatCard label="Gross sales" value={isDemoMode ? "₹4,82,650" : "—"} delta={isDemoMode ? "8.2%" : "Live API pending"} trend={isDemoMode ? "up" : "neutral"} icon={<CircleDollarSign size={19} />} tone="green" sub={isDemoMode ? "vs. previous 30 days" : "Live analytics pending"} /><StatCard label="Active customers" value={isDemoMode ? "1,204" : "—"} delta={isDemoMode ? "5.6%" : "Live API pending"} trend={isDemoMode ? "up" : "neutral"} icon={<Users size={19} />} tone="blue" sub={isDemoMode ? "vs. previous 30 days" : "Live analytics pending"} /><StatCard label="Needs attention" value={isDemoMode ? String(pending + services.filter(s => s.policyStatus === 'REVIEW_REQUIRED').length) : "—"} delta={isDemoMode ? `${pending} orders` : "API pending"} trend="neutral" icon={<ShieldAlert size={19} />} tone="amber" sub="orders + policy reviews" /></div>
    <div className="dashboard-grid"><section className="panel revenue-panel"><div className="panel-head"><div><h3>Performance overview</h3><p>{isDemoMode ? "Sample revenue and orders over the last 30 days" : "Connect the reporting API to load live metrics"}</p></div><button className="select-button">Last 30 days <ChevronDown size={14} /></button></div><div className="chart-legend"><span><i className="legend-dot purple" /> Revenue</span><span><i className="legend-dot mint" /> Orders</span><strong>{isDemoMode ? "₹4,82,650" : "—"} <small>{isDemoMode ? "sample revenue" : "report API pending"}</small></strong></div><div className="chart-area"><div className="chart-y-labels"><span>₹5L</span><span>₹3.5L</span><span>₹2L</span><span>₹0</span></div><div className="chart-main">{isDemoMode ? <><div className="chart-grid-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 720 190" preserveAspectRatio="none" className="revenue-svg" aria-label="Revenue trend"><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8977ed" stopOpacity=".22" /><stop offset="100%" stopColor="#8977ed" stopOpacity="0" /></linearGradient></defs><path d="M0 147 C30 138 38 135 65 139 S108 118 130 124 S169 99 195 112 S237 92 260 99 S298 82 325 90 S360 65 390 79 S428 70 454 75 S492 48 520 65 S560 42 585 49 S623 30 650 42 S690 18 720 22 L720 190 L0 190Z" fill="url(#areaFill)"/><path d="M0 147 C30 138 38 135 65 139 S108 118 130 124 S169 99 195 112 S237 92 260 99 S298 82 325 90 S360 65 390 79 S428 70 454 75 S492 48 520 65 S560 42 585 49 S623 30 650 42 S690 18 720 22" fill="none" stroke="#8371e8" strokeWidth="3" strokeLinecap="round"/><path d="M0 166 C40 158 62 160 95 156 S140 148 175 153 S220 141 255 147 S295 136 330 142 S365 130 400 135 S435 125 470 132 S505 118 540 124 S580 114 615 120 S665 107 720 110" fill="none" stroke="#60cbb0" strokeWidth="2.5" strokeDasharray="5 6" strokeLinecap="round"/></svg><div className="chart-x-labels"><span>Oct 17</span><span>Oct 22</span><span>Oct 27</span><span>Nov 01</span><span>Nov 06</span><span>Nov 11</span><span>Nov 15</span></div></> : <div className="live-placeholder">Live performance chart will appear when the reporting API is connected.</div>}</div></div></section>
      <section className="panel quick-panel"><div className="panel-head"><div><h3>Quick actions</h3><p>Get things moving</p></div><Sparkles size={18} className="muted-icon" /></div><div className="quick-actions"><QuickAction icon={<Tag size={18} />} title="Create category" desc="Organise your catalog" onClick={() => navigate('categories')} tone="lavender" /><QuickAction icon={<Package size={18} />} title="Add a service" desc="Publish a new offer" onClick={() => navigate('services')} tone="peach" /><QuickAction icon={<ClipboardList size={18} />} title="Review orders" desc={`${pending} waiting for action`} onClick={() => navigate('orders')} tone="mint" /><QuickAction icon={<ShieldCheck size={18} />} title="Policy checks" desc="Keep offers compliant" onClick={() => navigate('policy')} tone="blue" /></div></section></div>
    <div className="dashboard-bottom-grid"><section className="panel orders-panel"><div className="panel-head"><div><h3>Recent orders</h3><p>Latest customer activity</p></div><button className="link-button" onClick={() => navigate('orders')}>View all <ArrowRight size={14} /></button></div><div className="table-wrap"><table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>SERVICE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{orders.slice(0, 4).map(order => <tr key={order.id}><td><strong className="id-text">{order.id}</strong><small>{order.date.split(' · ')[0]}</small></td><td><strong>{order.customer}</strong></td><td><span className="truncate-cell">{order.service}</span></td><td><strong>{money(order.amount)}</strong></td><td><StatusPill status={order.status} /></td></tr>)}</tbody></table></div></section><section className="panel catalog-panel"><div className="panel-head"><div><h3>Catalog health</h3><p>What is available to customers</p></div><button className="link-button" onClick={() => navigate('services')}>Manage <ArrowRight size={14} /></button></div><div className="catalog-summary"><div className="catalog-big-number">{activeServices}<span>/{services.length}</span></div><div><strong>Approved active services</strong><small>Published in customer catalogue</small></div></div><div className="progress-track"><span style={{ width: `${services.length ? activeServices / services.length * 100 : 0}%` }} /></div><div className="catalog-breakdown"><div><span><i className="tiny-dot green-dot" /> Active platforms</span><strong>{platforms.filter(p => p.status === 'ACTIVE').length}</strong></div><div><span><i className="tiny-dot purple-dot" /> Categories</span><strong>{categories.filter(c => c.status === 'ACTIVE').length}</strong></div><div><span><i className="tiny-dot amber-dot" /> Policy review</span><strong>{services.filter(s => s.policyStatus === 'REVIEW_REQUIRED').length}</strong></div></div></section></div>
    <div className="bottom-insight-row"><div className="insight-card"><div className="insight-icon"><Users size={18} /></div><div><strong>{isDemoMode ? `${customers.length} demo customers` : 'Customer metrics pending'}</strong><span>{isDemoMode ? 'Sample customer accounts' : 'Phase 5 reporting integration'}</span></div><button onClick={() => navigate('customers')}><ArrowRight size={16} /></button></div><div className="insight-card"><div className="insight-icon insight-icon-green"><Globe size={18} /></div><div><strong>{platforms.length} connected platforms</strong><span>Catalog destinations</span></div><button onClick={() => navigate('platforms')}><ArrowRight size={16} /></button></div><div className="insight-card"><div className="insight-icon insight-icon-amber"><ShieldCheck size={18} /></div><div><strong>Manual fulfilment enabled</strong><span>Human-reviewed service delivery</span></div><button onClick={() => navigate('settings')}><ArrowRight size={16} /></button></div></div>
  </>;
}

function StatCard({ label, value, delta, trend, icon, tone, sub }: { label: string; value: string; delta: string; trend: string; icon: ReactNode; tone: string; sub: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}>{icon}</div></div><div className="stat-value">{value}</div><div className="stat-foot"><span className={`trend ${trend}`}><ArrowUpRight size={13} /> {delta}</span><span>{sub}</span></div></div>;
}
function QuickAction({ icon, title, desc, onClick, tone }: { icon: ReactNode; title: string; desc: string; onClick: () => void; tone: string }) { return <button className="quick-action" onClick={onClick}><div className={`quick-icon ${tone}`}>{icon}</div><div><strong>{title}</strong><span>{desc}</span></div><ArrowRight size={15} className="quick-arrow" /></button>; }
function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase().replaceAll('_', '-');
  const label = status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  return <span className={`status-pill status-${normalized}`}><i />{label}</span>;
}
function SearchBox({ value, onChange, placeholder = 'Search...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) { return <div className="table-search"><Search size={15} /><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></div>; }
function SectionToolbar({ children }: { children: ReactNode }) { return <div className="section-toolbar">{children}</div>; }
function EmptyState({ title, message }: { title: string; message: string }) { return <div className="empty-state"><div><Package size={22} /></div><strong>{title}</strong><span>{message}</span></div>; }

function PlatformsPage({ platforms, setPlatforms }: { platforms: Platform[]; setPlatforms: Dispatch<SetStateAction<Platform[]>> }) {
  const [query, setQuery] = useState(''); const [modal, setModal] = useState(false); const [name, setName] = useState(''); const [code, setCode] = useState(''); const [policyUrl, setPolicyUrl] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const filtered = platforms.filter(p => `${p.name} ${p.code}`.toLowerCase().includes(query.toLowerCase()));
  async function create() {
    setError(''); if (!name.trim() || !code.trim()) { setError('Platform name and code are required.'); return; }
    if (policyUrl.trim() && !/^https?:\/\//i.test(policyUrl.trim())) { setError('Policy URL must start with http:// or https://.'); return; }
    setBusy(true);
    try {
      if (!isDemoMode) {
        const payload = unwrap<any>(await apiRequest<any>(apiPaths.platforms, { method: 'POST', body: JSON.stringify({ name: name.trim(), code: code.trim().toUpperCase(), officialPolicyUrl: policyUrl.trim() || null }) }));
        setPlatforms(prev => [...prev, { id: payload.id, name: payload.name, code: payload.code, status: payload.status || 'ACTIVE', accent: '#8271e8', initials: payload.name?.slice(0, 2).toUpperCase() || 'PL', officialPolicyUrl: payload.officialPolicyUrl || null }]);
      } else setPlatforms(prev => [...prev, { id: Math.max(0, ...prev.map(p => p.id)) + 1, name: name.trim(), code: code.trim().toUpperCase().replaceAll(' ', '_'), status: 'ACTIVE', accent: '#8271e8', initials: name.trim().slice(0, 2).toUpperCase(), officialPolicyUrl: policyUrl.trim() || null }]);
      setModal(false); setName(''); setCode(''); setPolicyUrl('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create platform.'); }
    finally { setBusy(false); }
  }
  async function toggle(platform: Platform) {
    const next = platform.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      if (!isDemoMode) await apiRequest(`${apiPaths.platforms}/${platform.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, status: next } : p));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update platform status.'); }
  }
  return <><div className="callout callout-info"><div><InfoIcon /><div><strong>Platform availability controls the catalog</strong><span>Disabled platforms remain in your records, but should not be offered for new services or orders.</span></div></div><BadgeCheck size={20} /></div><section className="panel data-panel"><div className="panel-head"><div><h3>Social platforms</h3><p>{platforms.length} platforms in your workspace</p></div><button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={16} /> Add platform</button></div><SectionToolbar><SearchBox value={query} onChange={setQuery} placeholder="Search platforms..." /><span className="result-count">{filtered.length} results</span></SectionToolbar><div className="platform-grid">{filtered.map(p => <div className="platform-card" key={p.id}><div className="platform-card-top"><div className="platform-brand-icon" style={{ background: `${p.accent}18`, color: p.accent }}>{platformIcon(p.code, p.initials)}</div><button className="icon-button more-button" onClick={() => toggle(p)} title={p.status === 'ACTIVE' ? 'Disable platform' : 'Enable platform'}><MoreHorizontal size={18} /></button></div><h3>{p.name}</h3><span className="platform-code">{p.code}</span>{p.officialPolicyUrl && <a className="policy-link" href={p.officialPolicyUrl} target="_blank" rel="noreferrer">Official policy <ExternalLink size={11} /></a>}<div className="platform-card-bottom"><StatusPill status={p.status} /><button className={`text-button ${p.status === 'ACTIVE' ? 'text-danger' : ''}`} onClick={() => toggle(p)}>{p.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button></div></div>)}</div>{!filtered.length && <EmptyState title="No platforms found" message="Try another search term." />}</section>{modal && <Modal title="Add a platform" subtitle="Register a social channel for your service catalog." onClose={() => setModal(false)}><div className="form-stack"><label>Platform name<input className="form-input" value={name} onChange={e => { setName(e.target.value); setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')); }} placeholder="e.g. Pinterest" /></label><label>Platform code<input className="form-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. PINTEREST" /></label><label>Official policy URL (optional)<input className="form-input" type="url" value={policyUrl} onChange={e => setPolicyUrl(e.target.value)} placeholder="https://..." /></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={create} disabled={busy}>{busy ? 'Saving…' : 'Create platform'}</button></div></div></Modal>}</>;
}
function platformIcon(code: string, initials: string) { return <PlatformIcon code={code} name={initials} size={42} />; }
function InfoIcon() { return <div className="callout-icon"><CircleHelp size={17} /></div>; }

function CategoriesPage({ categories, setCategories, platforms }: { categories: Category[]; setCategories: Dispatch<SetStateAction<Category[]>>; platforms: Platform[] }) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('ALL'); const [modal, setModal] = useState(false); const [name, setName] = useState(''); const [platform, setPlatform] = useState('All platforms'); const [error, setError] = useState('');
  const filtered = categories.filter(c => (`${c.name} ${c.slug} ${c.platform}`).toLowerCase().includes(query.toLowerCase()) && (filter === 'ALL' || c.status === filter));
  function create() { if (!name.trim()) { setError('Enter a category name.'); return; } const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (categories.some(c => c.slug === slug)) { setError('A category with this slug already exists.'); return; } setCategories(prev => [{ id: Math.max(0, ...prev.map(c => c.id)) + 1, name: name.trim(), slug, platform, services: 0, status: 'ACTIVE', updated: 'Just now' }, ...prev]); setName(''); setError(''); setModal(false); }
  function toggle(id: number) { setCategories(prev => prev.map(c => c.id === id ? { ...c, status: c.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE', updated: 'Just now' } : c)); }
  return <>{!isDemoMode && <div className="callout callout-warning"><div><div className="callout-icon"><Cloud size={17} /></div><div><strong>Categories API is planned, not connected yet</strong><span>This screen is interactive in Demo Mode. Implement the category API contract before live changes.</span></div></div></div>}<div className="metric-strip"><MiniMetric label="Total categories" value={String(categories.length).padStart(2, '0')} icon={<Boxes size={17} />} /><MiniMetric label="Active categories" value={String(categories.filter(c => c.status === 'ACTIVE').length).padStart(2, '0')} icon={<CheckCircle2 size={17} />} /><MiniMetric label="Services organised" value={String(categories.reduce((sum, c) => sum + c.services, 0)).padStart(2, '0')} icon={<Package size={17} />} /></div><section className="panel data-panel"><div className="panel-head"><div><h3>Service categories</h3><p>Categories help customers find the right service.</p></div><button className="btn btn-primary" onClick={() => setModal(true)} disabled={!isDemoMode} title={!isDemoMode ? "Category API is not connected yet" : "Create category"}><Plus size={16} /> New category</button></div><SectionToolbar><SearchBox value={query} onChange={setQuery} placeholder="Search category or slug..." /><div className="toolbar-spacer" /><div className="filter-select"><Filter size={14} /><select value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option></select><ChevronDown size={13} /></div></SectionToolbar><div className="table-wrap"><table><thead><tr><th>CATEGORY</th><th>PLATFORM</th><th>SERVICES</th><th>LAST UPDATED</th><th>STATUS</th><th></th></tr></thead><tbody>{filtered.map(c => <tr key={c.id}><td><div className="primary-cell"><div className="category-cell-icon"><Tag size={17} /></div><div><strong>{c.name}</strong><small>/{c.slug}</small></div></div></td><td>{c.platform}</td><td><span className="count-badge">{c.services} services</span></td><td className="muted-cell">{c.updated}</td><td><StatusPill status={c.status} /></td><td><button className="table-action" disabled={!isDemoMode} onClick={() => toggle(c.id)}>{c.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title="No categories found" message="Create a category or adjust your filters." />}</div></section>{modal && <Modal title="Create category" subtitle="A clear category name helps customers browse your catalog." onClose={() => setModal(false)}><div className="form-stack"><label>Category name<input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Content & Creative" /></label><label>Platform<select className="form-input" value={platform} onChange={e => setPlatform(e.target.value)}><option>All platforms</option>{platforms.filter(p => p.status === 'ACTIVE').map(p => <option key={p.id}>{p.name}</option>)}</select></label><div className="field-hint">The category slug is generated automatically from its name.</div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={create}>Create category</button></div></div></Modal>}</>;
}
function MiniMetric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) { return <div className="mini-metric"><div className="mini-metric-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>; }

function ServicesPage({ services, setServices, categories }: { services: Service[]; setServices: Dispatch<SetStateAction<Service[]>>; categories: Category[] }) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('ALL'); const [modal, setModal] = useState(false); const [form, setForm] = useState({ name: '', category: categories[0]?.name || '', platform: 'All platforms', price: '999', unit: 'per project' }); const [error, setError] = useState('');
  const filtered = services.filter(s => (`${s.name} ${s.code} ${s.category} ${s.platform}`).toLowerCase().includes(query.toLowerCase()) && (filter === 'ALL' || s.status === filter));
  function create() { if (!form.name.trim() || !form.category || Number(form.price) <= 0) { setError('Provide a name, category and valid price.'); return; } const id = Math.max(100, ...services.map(s => s.id)) + 1; setServices(prev => [{ id, code: `SMM-${String(id).slice(-4)}`, name: form.name.trim(), category: form.category, platform: form.platform, fulfilment: 'MANUAL', policyStatus: 'REVIEW_REQUIRED', status: 'DRAFT', price: Number(form.price), unit: form.unit, updated: 'Just now' }, ...prev]); setModal(false); setError(''); setForm({ name: '', category: categories[0]?.name || '', platform: 'All platforms', price: '999', unit: 'per project' }); }
  function toggle(service: Service) { setServices(prev => prev.map(s => s.id === service.id ? { ...s, status: s.status === 'ACTIVE' ? 'PAUSED' : s.policyStatus === 'APPROVED' ? 'ACTIVE' : 'DRAFT' } : s)); }
  return <>{!isDemoMode && <div className="callout callout-info"><div><div className="callout-icon"><Cloud size={17} /></div><div><strong>Services API is planned, not connected yet</strong><span>This screen is interactive in Demo Mode. Implement service, input-definition and price-version APIs before live catalog changes.</span></div></div></div>}<div className="callout callout-warning"><div><div className="callout-icon"><ShieldAlert size={17} /></div><div><strong>Policy approval is required before publishing</strong><span>Only services marked ACTIVE and APPROVED should be visible and orderable by customers.</span></div></div><button className="text-button" onClick={() => setFilter('DRAFT')}>Review drafts <ArrowRight size={14} /></button></div><section className="panel data-panel"><div className="panel-head"><div><h3>Service catalog</h3><p>{services.length} services · manual fulfilment</p></div><button className="btn btn-primary" onClick={() => setModal(true)} disabled={!isDemoMode} title={!isDemoMode ? "Service API is not connected yet" : "Create service"}><Plus size={16} /> Create service</button></div><SectionToolbar><SearchBox value={query} onChange={setQuery} placeholder="Search services..." /><div className="toolbar-spacer" /><div className="filter-select"><Filter size={14} /><select value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="DRAFT">Draft</option></select><ChevronDown size={13} /></div></SectionToolbar><div className="table-wrap"><table><thead><tr><th>SERVICE</th><th>CATEGORY</th><th>PLATFORM</th><th>PRICE</th><th>POLICY</th><th>STATUS</th><th></th></tr></thead><tbody>{filtered.map(s => <tr key={s.id}><td><div className="service-name"><strong>{s.name}</strong><small>{s.code} · {s.fulfilment}</small></div></td><td>{s.category}</td><td>{s.platform}</td><td><strong>{money(s.price)}</strong><small className="table-sub">{s.unit}</small></td><td><StatusPill status={s.policyStatus} /></td><td><StatusPill status={s.status} /></td><td><button className="table-action" disabled={!isDemoMode} onClick={() => toggle(s)}>{s.status === 'ACTIVE' ? 'Pause' : 'Activate'}</button></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title="No services found" message="Try a different search or create a service." />}</div></section>{modal && <Modal title="Create a service" subtitle="New services begin as drafts and require policy approval." onClose={() => setModal(false)}><div className="form-stack"><label>Service name<input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Monthly content planning" /></label><div className="form-two"><label>Category<select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.filter(c => c.status === 'ACTIVE').map(c => <option key={c.id}>{c.name}</option>)}</select></label><label>Platform<select className="form-input" value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}><option>All platforms</option>{['Instagram', 'YouTube', 'Facebook', 'LinkedIn', 'X'].map(p => <option key={p}>{p}</option>)}</select></label></div><div className="form-two"><label>Price (INR)<input className="form-input" type="number" min="1" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></label><label>Price unit<select className="form-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}><option>per project</option><option>per month</option><option>per video</option><option>per session</option><option>fixed</option></select></label></div><div className="field-hint"><ShieldCheck size={14} /> Fulfilment is manual. This service will be saved as DRAFT / REVIEW_REQUIRED.</div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={create}>Save draft</button></div></div></Modal>}</>;
}


function PricingPage({ services, priceVersions, setPriceVersions }: { services: Service[]; priceVersions: PriceVersion[]; setPriceVersions: Dispatch<SetStateAction<PriceVersion[]>> }) {
  const [query, setQuery] = useState(''); const [serviceFilter, setServiceFilter] = useState('ALL'); const [modal, setModal] = useState(false); const [error, setError] = useState('');
  const [form, setForm] = useState({ serviceId: String(services[0]?.id || ''), amount: '999', unit: 'PER_UNIT' as PriceVersion['rateUnit'], min: '1', max: '10', minCharge: '999', effectiveFrom: '2026-11-16' });
  const filtered = priceVersions.filter(v => (`${v.serviceName} ${v.versionNo} ${v.rateUnit}`).toLowerCase().includes(query.toLowerCase()) && (serviceFilter === 'ALL' || String(v.serviceId) === serviceFilter));
  function createVersion() {
    const serviceId = Number(form.serviceId); const service = services.find(s => s.id === serviceId);
    const amount = Number(form.amount); const min = Number(form.min); const max = Number(form.max); const minCharge = Number(form.minCharge);
    if (!service) { setError('Choose a service first.'); return; }
    if (amount <= 0 || min <= 0 || max < min || minCharge < 0 || !form.effectiveFrom) { setError('Enter a valid rate, quantity range, minimum charge and effective date.'); return; }
    const versionNo = Math.max(0, ...priceVersions.filter(v => v.serviceId === serviceId).map(v => v.versionNo)) + 1;
    setPriceVersions(prev => [{ id: Math.max(0, ...prev.map(v => v.id)) + 1, serviceId, serviceName: service.name, versionNo, rateAmount: amount, rateUnit: form.unit, fixedPackageQuantity: form.unit === 'FIXED' ? min : null, minQuantity: min, maxQuantity: max, minCharge, taxMode: 'NOT_CONFIGURED', currency: 'INR', effectiveFrom: form.effectiveFrom, createdBy: 'Super Admin' }, ...prev]);
    setModal(false); setError('');
  }
  return <>{!isDemoMode && <div className="callout callout-info"><div><div className="callout-icon"><Cloud size={17} /></div><div><strong>Price-version API is planned, not connected yet</strong><span>Version creation is a local demo interaction until the immutable pricing endpoint is implemented.</span></div></div></div>}<div className="callout callout-warning"><div><div className="callout-icon"><LockKeyhole size={17} /></div><div><strong>Price versions are immutable</strong><span>Never overwrite a published price. Create a new version with a new effective date. Tax stays NOT_CONFIGURED until reviewed by your CA.</span></div></div><BadgeCheck size={20} /></div><div className="metric-strip"><MiniMetric label="Price versions" value={String(priceVersions.length).padStart(2, '0')} icon={<History size={17} />} /><MiniMetric label="Services priced" value={String(new Set(priceVersions.map(v => v.serviceId)).size).padStart(2, '0')} icon={<Package size={17} />} /><MiniMetric label="Currency" value="INR" icon={<CircleDollarSign size={17} />} /></div><section className="panel data-panel"><div className="panel-head"><div><h3>Price version history</h3><p>Each row is a historical price record. Previous versions remain unchanged.</p></div><button className="btn btn-primary" disabled={!isDemoMode || services.length === 0} onClick={() => setModal(true)}><Plus size={16} /> New price version</button></div><SectionToolbar><SearchBox value={query} onChange={setQuery} placeholder="Search service or version..." /><div className="toolbar-spacer" /><div className="filter-select"><Filter size={14} /><select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}><option value="ALL">All services</option>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><ChevronDown size={13} /></div></SectionToolbar><div className="table-wrap"><table><thead><tr><th>SERVICE</th><th>VERSION</th><th>RATE</th><th>QUANTITY RANGE</th><th>MINIMUM CHARGE</th><th>TAX</th><th>EFFECTIVE FROM</th><th>CREATED BY</th></tr></thead><tbody>{filtered.map(v => <tr key={v.id}><td><strong>{v.serviceName}</strong><small>Service #{v.serviceId}</small></td><td><span className="count-badge">v{v.versionNo}</span></td><td><strong>{money(v.rateAmount)}</strong><small>{v.rateUnit.replaceAll('_', ' ')}</small></td><td>{v.minQuantity} – {v.maxQuantity}</td><td>{money(v.minCharge)}</td><td><StatusPill status={v.taxMode} /></td><td className="muted-cell">{v.effectiveFrom}</td><td>{v.createdBy}</td></tr>)}</tbody></table>{!filtered.length && <EmptyState title="No price versions found" message="Create the first price version for an existing service." />}</div><div className="ledger-footnote"><ShieldCheck size={15} /> No inline edit/delete controls are provided for historical prices. Production versions must be written once and audited.</div></section>{modal && <Modal title="Create price version" subtitle="This creates a new immutable version. It does not modify an older price." onClose={() => setModal(false)}><div className="form-stack"><label>Service<select className="form-input" value={form.serviceId} onChange={e => setForm({ ...form, serviceId: e.target.value })}>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div className="form-two"><label>Rate amount (INR)<input className="form-input" type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><label>Rate unit<select className="form-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value as PriceVersion['rateUnit'] })}><option value="PER_UNIT">Per unit</option><option value="PER_1000">Per 1,000</option><option value="FIXED">Fixed package</option></select></label></div><div className="form-two"><label>Minimum quantity<input className="form-input" type="number" min="1" value={form.min} onChange={e => setForm({ ...form, min: e.target.value })} /></label><label>Maximum quantity<input className="form-input" type="number" min="1" value={form.max} onChange={e => setForm({ ...form, max: e.target.value })} /></label></div><div className="form-two"><label>Minimum charge (INR)<input className="form-input" type="number" min="0" step="0.01" value={form.minCharge} onChange={e => setForm({ ...form, minCharge: e.target.value })} /></label><label>Effective from<input className="form-input" type="date" value={form.effectiveFrom} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} /></label></div><div className="field-hint"><ShieldCheck size={14} /> Tax mode will remain NOT_CONFIGURED pending CA confirmation. Version numbers are assigned automatically.</div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={createVersion}>Create version</button></div></div></Modal>}</>;
}

function ServiceInputsPage({ services, serviceInputs, setServiceInputs }: { services: Service[]; serviceInputs: ServiceInput[]; setServiceInputs: Dispatch<SetStateAction<ServiceInput[]>> }) {
  const [query, setQuery] = useState(''); const [modal, setModal] = useState(false); const [error, setError] = useState('');
  const [form, setForm] = useState({ serviceId: String(services[0]?.id || ''), label: '', key: '', type: 'URL' as ServiceInput['inputType'], required: true, help: '', maxLength: '500', allowedValues: '' });
  const filtered = serviceInputs.filter(v => (`${v.label} ${v.inputKey} ${v.serviceName}`).toLowerCase().includes(query.toLowerCase()));
  function createInput() {
    const service = services.find(s => s.id === Number(form.serviceId));
    const key = form.key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const unsafe = /password|passwd|otp|token|cookie|recovery|secret|session|credential|passcode|api[_ -]?key|access[_ -]?key/i.test(`${form.label} ${key} ${form.help}`);
    if (!service || !form.label.trim() || !key) { setError('Choose a service and provide an input label.'); return; }
    if (unsafe) { setError('Authentication secrets are prohibited. Do not request passwords, OTPs, tokens, cookies or recovery codes.'); return; }
    if (serviceInputs.some(v => v.serviceId === service.id && v.inputKey === key)) { setError('This input key already exists for the selected service.'); return; }
    const allowedValues = form.type === 'SELECT' ? form.allowedValues.split(',').map(v => v.trim()).filter(Boolean) : [];
    if (form.type === 'SELECT' && allowedValues.length === 0) { setError('Add at least one allowed value for a SELECT input.'); return; }
    setServiceInputs(prev => [{ id: Math.max(0, ...prev.map(v => v.id)) + 1, serviceId: service.id, serviceName: service.name, inputKey: key, label: form.label.trim(), inputType: form.type, required: form.required, helpText: form.help.trim(), maxLength: form.type === 'TEXT' || form.type === 'URL' ? Number(form.maxLength) || 500 : null, allowedValues, active: true }, ...prev]);
    setModal(false); setError('');
  }
  function toggle(id: number) { setServiceInputs(prev => prev.map(v => v.id === id ? { ...v, active: !v.active } : v)); }
  return <>{!isDemoMode && <div className="callout callout-info"><div><div className="callout-icon"><Cloud size={17} /></div><div><strong>Service-input API is planned, not connected yet</strong><span>Input-definition controls are interactive in Demo Mode. Implement the backend input-definition endpoints before live changes.</span></div></div></div>}<div className="callout callout-warning"><div><div className="callout-icon"><ShieldAlert size={17} /></div><div><strong>Only collect information needed to deliver the service</strong><span>Supported types: URL, TEXT, NUMBER and SELECT. Never request social account passwords, OTPs, access tokens, cookies or recovery codes.</span></div></div><LockKeyhole size={20} /></div><section className="panel data-panel"><div className="panel-head"><div><h3>Customer input definitions</h3><p>{serviceInputs.length} fields across {new Set(serviceInputs.map(v => v.serviceId)).size} services</p></div><button className="btn btn-primary" disabled={!isDemoMode || services.length === 0} onClick={() => setModal(true)}><Plus size={16} /> Add input field</button></div><SectionToolbar><SearchBox value={query} onChange={setQuery} placeholder="Search input label, key or service..." /><span className="result-count">{filtered.length} fields</span></SectionToolbar><div className="table-wrap"><table><thead><tr><th>INPUT LABEL</th><th>SERVICE</th><th>INPUT KEY</th><th>TYPE</th><th>REQUIRED</th><th>ACTIVE</th><th></th></tr></thead><tbody>{filtered.map(v => <tr key={v.id}><td><div className="service-name"><strong>{v.label}</strong><small>{v.helpText}</small></div></td><td>{v.serviceName}</td><td className="id-text">{v.inputKey}</td><td><span className="count-badge">{v.inputType}</span></td><td>{v.required ? <StatusPill status="APPROVED" /> : <span className="muted-cell">Optional</span>}</td><td><StatusPill status={v.active ? 'ACTIVE' : 'DISABLED'} /></td><td><button className="table-action" disabled={!isDemoMode} onClick={() => toggle(v.id)}>{v.active ? 'Disable' : 'Enable'}</button></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title="No input fields found" message="Add a safe customer input to a service." />}</div><div className="ledger-footnote"><LockKeyhole size={15} /> Input definitions must not capture social account credentials or authentication secrets.</div></section>{modal && <Modal title="Add customer input" subtitle="Define a safe field that customers complete when ordering a service." onClose={() => setModal(false)}><div className="form-stack"><label>Service<select className="form-input" value={form.serviceId} onChange={e => setForm({ ...form, serviceId: e.target.value })}>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Field label<input className="form-input" value={form.label} onChange={e => { const key = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); setForm({ ...form, label: e.target.value, key }); }} placeholder="e.g. Public profile URL" /></label><div className="form-two"><label>Input type<select className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as ServiceInput['inputType'] })}><option value="URL">URL</option><option value="TEXT">Text</option><option value="NUMBER">Number</option><option value="SELECT">Select</option></select></label><label>Input key<input className="form-input" value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} /></label></div>{(form.type === 'URL' || form.type === 'TEXT') && <label>Maximum length<input className="form-input" type="number" min="1" max="5000" value={form.maxLength} onChange={e => setForm({ ...form, maxLength: e.target.value })} /></label>}{form.type === 'SELECT' && <label>Allowed values (comma separated)<input className="form-input" value={form.allowedValues} onChange={e => setForm({ ...form, allowedValues: e.target.value })} placeholder="Awareness, Education, Promotion" /></label>}<label>Help text<input className="form-input" value={form.help} onChange={e => setForm({ ...form, help: e.target.value })} placeholder="Explain what the customer should enter" /></label><label className="checkbox-row"><input type="checkbox" checked={form.required} onChange={e => setForm({ ...form, required: e.target.checked })} /> Required field</label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={createInput}>Add input</button></div></div></Modal>}</>;
}

function OrdersPage({ orders, setOrders }: { orders: Order[]; setOrders: Dispatch<SetStateAction<Order[]>> }) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('ALL'); const [selected, setSelected] = useState<Order | null>(null);
  const filtered = orders.filter(o => (`${o.id} ${o.customer} ${o.service}`).toLowerCase().includes(query.toLowerCase()) && (filter === 'ALL' || o.status === filter));
  function updateStatus(order: Order, status: Order['status']) { setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status } : o)); setSelected({ ...order, status }); }
  return <>{!isDemoMode && <div className="callout callout-info"><div><div className="callout-icon"><Cloud size={17} /></div><div><strong>Orders API is planned, not connected yet</strong><span>Live order rows and status updates will become available after the Spring Boot orders endpoints are implemented.</span></div></div></div>}<div className="metric-strip"><MiniMetric label="All orders" value={String(orders.length).padStart(2, '0')} icon={<ClipboardList size={17} />} /><MiniMetric label="Awaiting action" value={String(orders.filter(o => o.status === 'PENDING').length).padStart(2, '0')} icon={<Clock3 size={17} />} /><MiniMetric label="In progress" value={String(orders.filter(o => o.status === 'IN_PROGRESS').length).padStart(2, '0')} icon={<Activity size={17} />} /><MiniMetric label="Completed" value={String(orders.filter(o => o.status === 'COMPLETED').length).padStart(2, '0')} icon={<CheckCircle2 size={17} />} /></div><section className="panel data-panel"><div className="panel-head"><div><h3>Order management</h3><p>All work is reviewed and fulfilled by your team.</p></div><button className="btn btn-secondary" onClick={() => downloadCsv('smm-orders.csv', orders)}><Download size={15} /> Export</button></div><SectionToolbar><SearchBox value={query} onChange={setQuery} placeholder="Search order, customer or service..." /><div className="toolbar-spacer" /><div className="filter-select"><Filter size={14} /><select value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">All statuses</option>{['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => <option key={s}>{s}</option>)}</select><ChevronDown size={13} /></div></SectionToolbar><div className="table-wrap"><table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>SERVICE</th><th>QTY</th><th>AMOUNT</th><th>DATE</th><th>STATUS</th><th></th></tr></thead><tbody>{filtered.map(o => <tr key={o.id}><td><strong className="id-text">{o.id}</strong></td><td>{o.customer}</td><td><div className="service-name"><strong>{o.service}</strong><small>{o.platform}</small></div></td><td>{o.quantity}</td><td><strong>{money(o.amount)}</strong></td><td className="muted-cell">{o.date}</td><td><StatusPill status={o.status} /></td><td><button className="table-action" disabled={!isDemoMode} onClick={() => setSelected(o)}>Review</button></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title="No orders found" message="No orders match the current filters." />}</div></section>{selected && <Modal title={`Order ${selected.id}`} subtitle="Review the work details and update manual fulfilment status." onClose={() => setSelected(null)}><div className="order-detail"><div><span>Customer</span><strong>{selected.customer}</strong></div><div><span>Service</span><strong>{selected.service}</strong></div><div><span>Platform</span><strong>{selected.platform}</strong></div><div><span>Quantity</span><strong>{selected.quantity}</strong></div><div><span>Order total</span><strong>{money(selected.amount)}</strong></div><div><span>Current status</span><StatusPill status={selected.status} /></div></div><div className="policy-note"><ShieldCheck size={16} /><span>Confirm payment verification and scope before starting fulfilment. Record delivery evidence in the future order timeline API.</span></div><label className="modal-label">Update order status</label><div className="status-actions">{(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).map(s => <button key={s} className={`status-choice ${selected.status === s ? 'selected' : ''}`} onClick={() => updateStatus(selected, s)}>{selected.status === s && <Check size={13} />}{s.replaceAll('_', ' ')}</button>)}</div><div className="modal-actions"><button className="btn btn-primary" onClick={() => setSelected(null)}>Done</button></div></Modal>}</>;
}

function CustomersPage({ customers }: { customers: Customer[] }) {
  const [query, setQuery] = useState(''); const [selected, setSelected] = useState<Customer | null>(null);
  const filtered = customers.filter(c => `${c.name} ${c.email} ${c.id}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="metric-strip"><MiniMetric label="Total customers" value={String(customers.length).padStart(2, '0')} icon={<Users size={17} />} /><MiniMetric label="Active accounts" value={String(customers.filter(c => c.status === 'ACTIVE').length).padStart(2, '0')} icon={<CheckCircle2 size={17} />} /><MiniMetric label="Awaiting verification" value={String(customers.filter(c => c.status === 'PENDING_VERIFICATION').length).padStart(2, '0')} icon={<Clock3 size={17} />} /></div><section className="panel data-panel"><div className="panel-head"><div><h3>Customer directory</h3><p>Customer data is visible to the Super Admin only.</p></div><button className="btn btn-secondary" onClick={() => downloadCsv('smm-customers.csv', customers)}><Download size={15} /> Export</button></div><SectionToolbar><SearchBox value={query} onChange={setQuery} placeholder="Search by customer, email or ID..." /><span className="result-count">{filtered.length} customers</span></SectionToolbar><div className="table-wrap"><table><thead><tr><th>CUSTOMER</th><th>CUSTOMER ID</th><th>ORDERS</th><th>TOTAL SPENT</th><th>JOINED</th><th>ACCOUNT STATUS</th><th></th></tr></thead><tbody>{filtered.map(c => <tr key={c.id}><td><div className="customer-cell"><div className="customer-avatar">{initials(c.name)}</div><div><strong>{c.name}</strong><small>{c.email}</small></div></div></td><td className="id-text">{c.id}</td><td>{c.orders}</td><td><strong>{money(c.spent)}</strong></td><td className="muted-cell">{c.joined}</td><td><StatusPill status={c.status} /></td><td><button className="table-action" onClick={() => setSelected(c)}>View</button></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title="No customers found" message="Try a different search term." />}</div></section>{selected && <Modal title={selected.name} subtitle="Customer account overview" onClose={() => setSelected(null)}><div className="customer-profile"><div className="customer-avatar large">{initials(selected.name)}</div><div><strong>{selected.name}</strong><span>{selected.email}</span><StatusPill status={selected.status} /></div></div><div className="order-detail"><div><span>Customer ID</span><strong>{selected.id}</strong></div><div><span>Orders placed</span><strong>{selected.orders}</strong></div><div><span>Total spend</span><strong>{money(selected.spent)}</strong></div><div><span>Member since</span><strong>{selected.joined}</strong></div></div><div className="policy-note"><LockKeyhole size={16} /><span>Customer records are scoped to the authenticated account in customer APIs. Admin access is audited. Never expose passwords, OTPs or authentication secrets.</span></div><div className="modal-actions"><button className="btn btn-primary" onClick={() => setSelected(null)}>Close</button></div></Modal>}</>;
}

function WalletPage() {
  const [tab, setTab] = useState<'ledger' | 'payments'>('ledger');
  return <><div className="callout callout-warning"><div><div className="callout-icon"><ShieldAlert size={17} /></div><div><strong>Read-only financial oversight</strong><span>Wallet credits must follow authoritative bank/acquirer verification and double-entry ledger posting. No manual balance edits, transfers or withdrawals.</span></div></div><ShieldCheck size={20} /></div><div className="wallet-summary-grid"><div className="wallet-balance-card"><div className="wallet-label"><Wallet size={17} /> CUSTOMER WALLET LIABILITIES</div><div className="wallet-balance">{isDemoMode ? "₹2,48,560" : "—"}</div><div className="wallet-trend">{isDemoMode ? <><span><ArrowUpRight size={13} /> 6.4%</span> vs last month</> : "Live wallet API pending"}</div><div className="wallet-card-bottom"><span>Reconciled ledger balance</span><span>INR <i /></span></div></div><div className="wallet-kpi"><span>Verified top-ups</span><strong>{isDemoMode ? "₹3,84,200" : "—"}</strong><small>This month</small><div className="wallet-kpi-icon green"><ArrowDownLeft size={18} /></div></div><div className="wallet-kpi"><span>Order debits</span><strong>{isDemoMode ? "₹2,91,840" : "—"}</strong><small>This month</small><div className="wallet-kpi-icon purple"><ArrowUpRight size={18} /></div></div><div className="wallet-kpi"><span>Awaiting verification</span><strong>{isDemoMode ? "₹12,500" : "—"}</strong><small>Not credited to wallets</small><div className="wallet-kpi-icon amber"><Clock3 size={18} /></div></div></div><section className="panel data-panel"><div className="panel-head"><div><h3>Financial activity</h3><p>Review verified payment events and ledger postings.</p></div><button className="btn btn-secondary" disabled={!isDemoMode} onClick={() => downloadCsv('smm-ledger-demo.csv', seedLedger)}><Download size={15} /> Export ledger</button></div><div className="tab-bar"><button className={tab === 'ledger' ? 'tab-active' : ''} onClick={() => setTab('ledger')}>Wallet ledger</button><button className={tab === 'payments' ? 'tab-active' : ''} onClick={() => setTab('payments')}>Payment intents</button></div>{tab === 'ledger' ? isDemoMode ? <div className="table-wrap"><table><thead><tr><th>ENTRY</th><th>CUSTOMER</th><th>TYPE</th><th>REFERENCE</th><th>AMOUNT</th><th>DATE</th><th>STATUS</th></tr></thead><tbody>{seedLedger.map(row => <tr key={row.id}><td><strong className="id-text">{row.id}</strong></td><td>{row.customer}</td><td>{row.type}</td><td className="id-text">{row.reference}</td><td><strong className={row.direction === 'CREDIT' ? 'amount-credit' : 'amount-debit'}>{row.direction === 'CREDIT' ? '+' : '−'}{money(row.amount)}</strong></td><td className="muted-cell">{row.date}</td><td><StatusPill status={row.status === 'Verified' ? 'APPROVED' : 'COMPLETED'} /></td></tr>)}</tbody></table></div> : <EmptyState title="Live ledger API not connected" message="Implement the wallet ledger endpoint before viewing production entries." /> : isDemoMode ? <div className="table-wrap"><table><thead><tr><th>PAYMENT INTENT</th><th>CUSTOMER</th><th>AMOUNT</th><th>RAIL</th><th>STATUS</th><th>NOTE</th></tr></thead><tbody><tr><td className="id-text">PAY-77111</td><td>Meera Reddy</td><td><strong>₹2,500</strong></td><td>Dynamic UPI QR</td><td><StatusPill status="PENDING" /></td><td className="muted-cell">Awaiting bank confirmation</td></tr><tr><td className="id-text">PAY-77108</td><td>Aarav Sharma</td><td><strong>₹5,000</strong></td><td>Dynamic UPI QR</td><td><StatusPill status="APPROVED" /></td><td className="muted-cell">Verified by acquirer feed</td></tr></tbody></table></div> : <EmptyState title="Live payments API not connected" message="Implement payment-intent APIs before viewing production payment events." />}<div className="ledger-footnote"><ShieldCheck size={15} /> Demo figures only. In production, payment status and ledger postings must come from the bank/acquirer verification pipeline.</div></section></>;
}

function PolicyPage({ services, setServices }: { services: Service[]; setServices: Dispatch<SetStateAction<Service[]>> }) {
  const [selected, setSelected] = useState<Service | null>(null);
  const pending = services.filter(s => s.policyStatus === 'REVIEW_REQUIRED' || s.policyStatus === 'SUSPENDED');
  function decide(service: Service, approved: boolean) { const updated = { ...service, policyStatus: approved ? 'APPROVED' as const : 'SUSPENDED' as const, status: approved ? 'ACTIVE' as const : 'PAUSED' as const, updated: 'Just now' }; setServices(prev => prev.map(s => s.id === service.id ? updated : s)); setSelected(null); }
  return <>{!isDemoMode && <div className="callout callout-warning"><div><div className="callout-icon"><Cloud size={17} /></div><div><strong>Policy review API is planned, not connected yet</strong><span>Approval controls are active only in Demo Mode until the backend approval and audit endpoints exist.</span></div></div></div>}<div className="callout callout-info"><div><div className="callout-icon"><ShieldCheck size={17} /></div><div><strong>Compliant services only</strong><span>Do not approve artificial followers, likes, views, comments, watch time, bots, credential collection or policy evasion.</span></div></div><BookOpen size={20} /></div><div className="metric-strip"><MiniMetric label="Awaiting review" value={String(pending.length).padStart(2, '0')} icon={<Clock3 size={17} />} /><MiniMetric label="Approved services" value={String(services.filter(s => s.policyStatus === 'APPROVED').length).padStart(2, '0')} icon={<BadgeCheck size={17} />} /><MiniMetric label="Suspended" value={String(services.filter(s => s.policyStatus === 'SUSPENDED').length).padStart(2, '0')} icon={<ShieldAlert size={17} />} /></div><section className="panel data-panel"><div className="panel-head"><div><h3>Policy review queue</h3><p>Every service must be reviewed before it can be published.</p></div><span className="queue-count">{pending.length} to review</span></div>{pending.length ? <div className="review-list">{pending.map(s => <div className="review-item" key={s.id}><div className="review-icon"><FileCheck2 size={19} /></div><div className="review-content"><strong>{s.name}</strong><span>{s.code} · {s.platform} · {s.category}</span><small>Manual fulfilment · {money(s.price)} {s.unit}</small></div><StatusPill status={s.policyStatus} /><button className="btn btn-secondary btn-small" disabled={!isDemoMode} onClick={() => setSelected(s)}>Review service <ArrowRight size={14} /></button></div>)}</div> : <EmptyState title="All caught up" message="There are no services waiting for policy review." />}</section>{selected && <Modal title="Review service" subtitle="Evaluate the offer against platform terms and your responsible-growth policy." onClose={() => setSelected(null)}><div className="review-detail"><div className="review-detail-icon"><ShieldCheck size={23} /></div><h3>{selected.name}</h3><span>{selected.code} · {selected.platform}</span><p>This is a manually fulfilled service. Confirm that the deliverables are transparent, authentic and permitted by the relevant platform's rules.</p></div><div className="policy-checklist"><div><CheckCircle2 size={16} /><span>No artificial followers, likes, views or engagement manipulation</span></div><div><CheckCircle2 size={16} /><span>No customer password, OTP, cookie or recovery-code collection</span></div><div><CheckCircle2 size={16} /><span>No spam, automation abuse or platform-policy evasion</span></div><div><CheckCircle2 size={16} /><span>Clear scope, realistic outcomes and manual delivery evidence</span></div></div><div className="modal-actions"><button className="btn btn-danger" onClick={() => decide(selected, false)}>Reject & suspend</button><button className="btn btn-primary" onClick={() => decide(selected, true)}><Check size={15} /> Approve service</button></div><div className="field-hint">Demo decision only. Production approval must create an immutable audit event.</div></Modal>}</>;
}

function ReportsPage({ orders, customers }: { orders: Order[]; customers: Customer[] }) {
  const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);
  const bars = [42, 58, 47, 68, 55, 78, 63, 84, 72, 92, 74, 98];
  return <><div className="report-intro"><div><span className="eyebrow">REPORTING SNAPSHOT</span><h2>Understand what is working.</h2><p>{isDemoMode ? "Illustrative demo analytics. Production reports will be computed from verified orders and ledger entries." : "The live reports API is not connected yet."}</p></div><button className="btn btn-secondary" onClick={() => downloadCsv('smm-report-orders.csv', orders)}><Download size={15} /> Export data</button></div><div className="stat-grid report-stats"><StatCard label="Revenue in sample" value={isDemoMode ? money(totalRevenue) : "—"} delta={isDemoMode ? "Sample data" : "API pending"} trend="neutral" icon={<CircleDollarSign size={19} />} tone="green" sub="current demo orders" /><StatCard label="Customers in sample" value={isDemoMode ? String(customers.length) : "—"} delta={isDemoMode ? "Sample data" : "API pending"} trend="neutral" icon={<Users size={19} />} tone="blue" sub="seeded accounts" /><StatCard label="Completed orders" value={isDemoMode ? String(orders.filter(o => o.status === 'COMPLETED').length) : "—"} delta={isDemoMode ? "Sample data" : "API pending"} trend="neutral" icon={<CheckCircle2 size={19} />} tone="violet" sub="completed status" /><StatCard label="Open orders" value={isDemoMode ? String(orders.filter(o => ['PENDING', 'IN_PROGRESS'].includes(o.status)).length) : "—"} delta={isDemoMode ? "Sample data" : "API pending"} trend="neutral" icon={<Activity size={19} />} tone="amber" sub="pending + in progress" /></div><div className="dashboard-grid"><section className="panel report-chart-panel"><div className="panel-head"><div><h3>Monthly revenue trend</h3><p>Illustrative reporting visual</p></div><span className="select-button">2026 <ChevronDown size={14} /></span></div><div className="bar-chart">{isDemoMode ? bars.map((h, i) => <div className="bar-column" key={i}><div className="bar-value" style={{ height: `${h}%` }} /><span>{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</span></div>) : <div className="live-placeholder">Live reports endpoint is planned</div>}</div></section><section className="panel report-side-panel"><div className="panel-head"><div><h3>Operational focus</h3><p>Recommended metrics to monitor</p></div></div><div className="focus-list"><FocusItem title="On-time fulfilment" value="Track" desc="Compare promised and actual delivery dates." /><FocusItem title="Refund / cancellation rate" value="Track" desc="Measure customer experience and service clarity." /><FocusItem title="Payment reconciliation" value="Critical" desc="Match bank-confirmed credits to unique payment intents." /><FocusItem title="Policy review coverage" value="Critical" desc="Ensure all live services have current approval." /></div></section></div></>;
}
function FocusItem({ title, value, desc }: { title: string; value: string; desc: string }) { return <div className="focus-item"><div><strong>{title}</strong><span>{desc}</span></div><em className={value === 'Critical' ? 'focus-critical' : ''}>{value}</em></div>; }

function AuditPage() {
  return <><div className="callout callout-info"><div><div className="callout-icon"><Fingerprint size={17} /></div><div><strong>Auditability is part of platform security</strong><span>Record who changed what, when and why. Never include passwords, JWTs, OTPs, recovery codes or MFA secrets in logs.</span></div></div><LockKeyhole size={20} /></div><section className="panel data-panel"><div className="panel-head"><div><h3>Administrative activity</h3><p>Illustrative activity feed for the demo workspace.</p></div><button className="btn btn-secondary" disabled={!isDemoMode} onClick={() => downloadCsv('smm-audit-demo.csv', seedAudit)}><Download size={15} /> Export</button></div>{isDemoMode ? <div className="table-wrap"><table><thead><tr><th>ACTOR</th><th>ACTION</th><th>TARGET</th><th>TIME</th><th>SOURCE</th></tr></thead><tbody>{seedAudit.map((a, i) => <tr key={i}><td><div className="customer-cell"><div className="customer-avatar mini-admin">SA</div><strong>{a.actor}</strong></div></td><td>{a.action}</td><td><strong>{a.target}</strong></td><td className="muted-cell">{a.time}</td><td className="id-text">{a.ip}</td></tr>)}</tbody></table></div> : <EmptyState title="Live audit API not connected" message="Implement the audit-log endpoint before viewing production events." />}<div className="ledger-footnote"><ShieldCheck size={15} /> Demo audit events only. Connect the immutable audit-log API before production use.</div></section></>;
}

function SettingsPage({ onNotice }: { onNotice: (n: Notice) => void }) {
  const [tab, setTab] = useState<'security' | 'connection' | 'workspace'>('security');
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_API_BASE_URL || 'https://YOUR-CLOUDFLARE-TUNNEL.trycloudflare.com');
  return <><div className="settings-layout"><div className="settings-nav panel"><button className={tab === 'security' ? 'settings-nav-active' : ''} onClick={() => setTab('security')}><Shield size={17} /> Admin security</button><button className={tab === 'connection' ? 'settings-nav-active' : ''} onClick={() => setTab('connection')}><Cloud size={17} /> API connection</button><button className={tab === 'workspace' ? 'settings-nav-active' : ''} onClick={() => setTab('workspace')}><Briefcase size={17} /> Workspace</button></div><div className="panel settings-content">{tab === 'security' && <><div className="settings-section-head"><div><h3>Admin security</h3><p>Protect the single Super Admin account and every sensitive action.</p></div><span className="secure-status"><ShieldCheck size={14} /> MFA required by policy</span></div><SettingRow icon={<Fingerprint size={18} />} title="Multi-factor authentication" desc="Authenticator app (TOTP) and one-time recovery codes." status="Backend setup in progress" /><SettingRow icon={<LockKeyhole size={18} />} title="Admin session controls" desc="Short-lived access token, dedicated admin refresh session and logout revocation." status="API pending" /><SettingRow icon={<History size={18} />} title="Sensitive-action audit" desc="Record catalog edits, policy decisions, payment reviews and security changes." status="API pending" /><SettingRow icon={<ShieldAlert size={18} />} title="Bootstrap enrollment" desc="Local-only setup route. Remove or disable after MFA enrollment is complete." status="Local profile only" /><div className="settings-warning"><AlertTriangle size={16} /><span>Never expose bootstrap endpoints publicly. Production admin routes must require both SUPER_ADMIN and an MFA-authenticated session.</span></div></>}{tab === 'connection' && <><div className="settings-section-head"><div><h3>Backend connection</h3><p>Configure the Vercel frontend to call your Spring Boot API through Cloudflare Tunnel.</p></div><span className={`connection-status ${isDemoMode ? 'demo' : ''}`}><i /> {isDemoMode ? 'Demo mode' : 'Live API mode'}</span></div><label className="settings-label">Backend API base URL<input className="form-input" value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="https://your-tunnel.trycloudflare.com" /></label><div className="connection-info"><div><span>Frontend mode</span><strong>{isDemoMode ? 'Local sample data' : 'Live backend'}</strong></div><div><span>API requests</span><strong>HTTPS + Bearer access token</strong></div><div><span>Refresh cookie</span><strong>HttpOnly · credentials included</strong></div></div><div className="settings-warning"><AlertTriangle size={16} /><span>Changing this field does not change the Vite environment at runtime. Set VITE_API_BASE_URL in your Vercel project environment and redeploy.</span></div><div className="settings-code"><div><span>Vercel environment variable</span><button onClick={() => navigator.clipboard?.writeText('VITE_API_BASE_URL=https://YOUR-CLOUDFLARE-TUNNEL.trycloudflare.com')}>Copy</button></div><code>VITE_API_BASE_URL=https://YOUR-CLOUDFLARE-TUNNEL.trycloudflare.com</code><code>VITE_DEMO_MODE=false</code></div><button className="btn btn-secondary" onClick={() => onNotice({ kind: 'info', text: 'Set the VITE_API_BASE_URL and VITE_DEMO_MODE variables in Vercel, then redeploy.' })}><ExternalLink size={15} /> Deployment instructions</button></>}{tab === 'workspace' && <><div className="settings-section-head"><div><h3>Workspace preferences</h3><p>General configuration for the admin workspace.</p></div></div><SettingRow icon={<Globe size={18} />} title="Currency" desc="Indian Rupee (INR) for catalog prices and reporting." status="INR" /><SettingRow icon={<CalendarDays size={18} />} title="Display timezone" desc="Dates and times shown in the workspace." status="Asia/Kolkata" /><SettingRow icon={<Users size={18} />} title="Admin model" desc="One designated Super Admin. No generic staff or admin roles in release one." status="Single Super Admin" /><SettingRow icon={<Package size={18} />} title="Fulfilment mode" desc="Human-managed fulfilment. Provider automation is not enabled." status="MANUAL" /><SettingRow icon={<CreditCard size={18} />} title="Wallet model" desc="Prepaid customer wallet for your own services only; no transfers or withdrawals." status="Prepaid only" /></>}</div></div></>;
}
function SettingRow({ icon, title, desc, status }: { icon: ReactNode; title: string; desc: string; status: string }) { return <div className="setting-row"><div className="setting-row-icon">{icon}</div><div className="setting-row-copy"><strong>{title}</strong><span>{desc}</span></div><em>{status}</em></div>; }


function GlobalSearchModal({ query, setQuery, onClose, onNavigate, platforms, categories, services, orders, customers }: { query: string; setQuery: (v: string) => void; onClose: () => void; onNavigate: (p: PageKey) => void; platforms: Platform[]; categories: Category[]; services: Service[]; orders: Order[]; customers: Customer[] }) {
  const items: { title: string; subtitle: string; page: PageKey }[] = [
    ...platforms.map(v => ({ title: v.name, subtitle: `Platform · ${v.code}`, page: 'platforms' as PageKey })),
    ...categories.map(v => ({ title: v.name, subtitle: `Category · ${v.slug}`, page: 'categories' as PageKey })),
    ...services.map(v => ({ title: v.name, subtitle: `Service · ${v.code}`, page: 'services' as PageKey })),
    ...orders.map(v => ({ title: v.id, subtitle: `Order · ${v.customer} · ${v.service}`, page: 'orders' as PageKey })),
    ...customers.map(v => ({ title: v.name, subtitle: `Customer · ${v.email}`, page: 'customers' as PageKey })),
    ...Object.entries(pageMeta).map(([key, value]) => ({ title: value.title, subtitle: `Workspace section · ${value.description}`, page: key as PageKey })),
  ];
  const results = items.filter(item => `${item.title} ${item.subtitle}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  return <Modal title="Search workspace" subtitle="Find a customer, order, service or workspace section." onClose={onClose}><div className="global-search-field"><Search size={17} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Start typing to search…" /></div><div className="global-search-results">{results.length ? results.map((item, i) => <button key={`${item.page}-${item.title}-${i}`} onClick={() => onNavigate(item.page)}><span className="global-result-icon"><ArrowRight size={15} /></span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span><ChevronRight size={15} /></button>) : <EmptyState title="No matching results" message="Try a different search term." />}</div><div className="global-search-foot">Press <kbd>Esc</kbd> to close <span>·</span> Results are limited to data currently loaded in this workspace.</div></Modal>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal"><div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>{children}</div></div>; }
function initials(name: string) { return name.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function downloadCsv(filename: string, rows: any[]) { if (!rows.length) return; const keys = Object.keys(rows[0]); const cell = (v: any) => `"${String(v ?? '').replaceAll('"', '""')}"`; const csv = [keys.join(','), ...rows.map(row => keys.map(key => cell(row[key])).join(','))].join('\r\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }

export default App;
