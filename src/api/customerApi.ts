import { apiRequest, setAccessToken, unwrap, ApiError } from './http';
import type { ServiceDto, PriceDto, InputDto, PricePreview } from './catalogApi';

/* ------------------------------------------------------------------ *
 * Customer API client.
 * "REAL" endpoints exist in the Spring Boot backend today.
 * "PLANNED" endpoints follow API_CONTRACT.md and must be built server-side.
 * ------------------------------------------------------------------ */

const V1 = '/api/v1';
const post = (body?: unknown, headers?: Record<string, string>): RequestInit => ({ method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), headers });

export type Session = { publicId: string; displayName: string; roles: string[] };
type LoginData = Session & { accessToken: string; tokenType: string; expiresInSeconds: number };

export type Registration = { publicId: string; displayName: string; phoneE164: string; status: string; nextStep: string };
export type OtpSent = { destinationMasked: string; expiresAt: string; resendAvailableAt: string };
export type CustomerProfile = {
  publicId: string; customerNumber: string | null; displayName: string; phoneE164: string | null; email: string | null;
  status: string; phoneVerified: boolean; emailVerified: boolean; phoneVerifiedAt: string | null; emailVerifiedAt: string | null; createdAt: string;
};
export type PlatformDto = { id: number; code: string; name: string; officialPolicyUrl: string | null; status: 'ACTIVE' | 'DISABLED' };

/* ---------------- PLANNED contract types (money = decimal string) ---------------- */
export type Page<T> = { items: T[]; page: number; size: number; totalItems: number; totalPages: number };
export type InputDef = { inputKey: string; label: string; inputType: 'URL' | 'TEXT' | 'NUMBER' | 'SELECT'; required: boolean; helpText?: string; maxLength?: number; allowedValues?: string[] };
export type CatalogCategory = { id: number; name: string; slug: string; platformId: number | null };
export type CatalogService = {
  publicId: string; name: string; description: string; platformCode: string | null; categoryId: number; categoryName: string;
  rateAmount: string; rateUnit: 'PER_1000' | 'PER_UNIT' | 'FIXED'; minimumQuantity: number; maximumQuantity: number; minimumCharge: string; currency: 'INR';
  inputs?: InputDef[];
};
export type Quote = { quoteId: string; servicePublicId: string; quantity: number; subtotal: string; taxAmount: string; total: string; currencyCode: 'INR'; status: string; expiresAt: string };
export type OrderDto = { orderNumber: string; serviceName: string; quantity: number; subtotal: string; taxAmount: string; total: string; totalAmount: string; currencyCode: 'INR'; status: string; submittedAt: string; amountReserved?: string; amountCaptured?: string; amountReleased?: string; timeline?: { toStatus: string; note?: string | null; createdAt: string }[] };
export type OrderDetail = { order: OrderDto; inputs: {key:string;label:string;type:string;value:string}[]; history: {fromStatus:string|null;toStatus:string;reasonCode:string|null;note:string|null;at:string}[]; fulfilment: {type:string;quantityCompleted?:number;customerNote?:string;at:string}[]; refunds: {reference:string;amount:string;destination:string;status:string}[] };
export const normalizeOrder = (o: any): OrderDto => ({...o, totalAmount: String(o.total ?? o.totalAmount ?? 0), total: String(o.total ?? o.totalAmount ?? 0), subtotal: String(o.subtotal ?? o.subtotalAmount ?? 0), taxAmount: String(o.taxAmount ?? 0)});
export const normalizePage = <T,>(p: any, map: (v:any)=>T = (v:any)=>v as T): Page<T> => ({items: (p?.content ?? p?.items ?? []).map(map),page:p?.number ?? p?.page ?? 0,size:p?.size ?? 20,totalItems:p?.totalElements ?? p?.totalItems ?? 0,totalPages:p?.totalPages ?? 0});
export type WalletSummary = { availableBalance: string | number; reservedBalance: string | number; totalBalance?: string | number; currencyCode: 'INR'; status: 'ACTIVE' | 'FROZEN' | 'CLOSED' };
export type LedgerRow = { id: number; operationType: string; direction: 'CREDIT' | 'DEBIT'; amount: string; displayDescription: string; createdAt: string };
// Razorpay Standard Checkout: an order is NOT proof of payment or wallet credit.
export type CreateTopupResponse = {
  paymentIntentId: string;
  topupNumber: string;
  amount: string | number;
  amountInPaise: number;
  currencyCode: 'INR';
  status: string;
  razorpayOrderId: string | null;
  razorpayKeyId: string | null; // public key only; the secret never belongs in the frontend
};
export type VerifyTopupRequest = {
  paymentIntentId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
export type VerifyTopupResponse = { status?: string; walletCredited?: boolean; message?: string; topupNumber?: string };
export type TopupDto = { topupNumber: string; amount: string | number; status: 'PENDING' | 'CREDITED' | 'REVIEW_REQUIRED' | 'FAILED' | 'EXPIRED' | 'REVERSED' | 'AWAITING_PAYMENT'; creditedAt?: string | null };
export type TicketDto = { ticketNumber: string; subject: string; category: string; status: string; priority: string; createdAt: string; messages?: { senderType: 'CUSTOMER' | 'ADMIN'; messageText: string; createdAt: string }[] };
export type AnnouncementDto = { id: number; title: string; body: string; publishedAt: string };

/* ---------------- session + automatic refresh ---------------- */
let onExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: (() => void) | null) => { onExpired = fn; };
let refreshing: Promise<Session> | null = null;

function toSession(d: LoginData): Session { setAccessToken(d.accessToken); return { publicId: d.publicId, displayName: d.displayName, roles: d.roles }; }

/** Single-flight: refresh tokens rotate, so concurrent refreshes would invalidate each other. */
export function refreshSession(): Promise<Session> {
  if (!refreshing) {
    refreshing = apiRequest<any>(`${V1}/auth/refresh`, post()).then(r => toSession(unwrap<LoginData>(r))).finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  try { return unwrap<T>(await apiRequest<any>(path, init)); }
  catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      try { await refreshSession(); } catch { setAccessToken(null); onExpired?.(); throw err; }
      return unwrap<T>(await apiRequest<any>(path, init));
    }
    throw err;
  }
}
const idem = () => ({ 'Idempotency-Key': crypto.randomUUID() });
const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
  const s = p.toString(); return s ? `?${s}` : '';
};

/* ---------------- REAL: auth ---------------- */
export const authApi = {
  register: (b: { displayName: string; phoneE164: string; password: string }) => apiRequest<any>(`${V1}/auth/register`, post(b)).then(r => unwrap<Registration>(r)),
  sendOtp: (publicId: string) => apiRequest<any>(`${V1}/auth/phone-verification/${publicId}/send`, post()).then(r => unwrap<OtpSent>(r)),
  verifyOtp: (publicId: string, otp: string) => apiRequest<any>(`${V1}/auth/phone-verification/${publicId}/verify`, post({ otp })).then(r => unwrap<{ phoneVerified: boolean; status: string }>(r)),
  login: (b: { phoneE164: string; password: string }) => apiRequest<any>(`${V1}/auth/login`, post(b)).then(r => toSession(unwrap<LoginData>(r))),
  google: (idToken: string) => apiRequest<any>(`${V1}/auth/google`, post({ idToken })).then(r => toSession(unwrap<LoginData>(r))),
  logout: async () => { try { await apiRequest(`${V1}/auth/logout`, post()); } finally { setAccessToken(null); } },
  logoutAll: async () => { try { await call(`${V1}/auth/logout-all`, post()); } finally { setAccessToken(null); } },
  resetRequest: (phoneE164: string) => apiRequest(`${V1}/auth/password-reset/request`, post({ phoneE164 })),
  resetConfirm: (b: { phoneE164: string; otp: string; newPassword: string }) => apiRequest(`${V1}/auth/password-reset/confirm`, post(b)),
};

function mergeCatalogService(s: ServiceDto, p: PriceDto, platforms: PlatformDto[], categories: CatalogCategory[]): CatalogService {
  return {
    publicId: s.publicId, name: s.name, description: s.description,
    platformCode: platforms.find(platform => platform.id === s.platformId)?.code ?? null,
    categoryId: s.categoryId, categoryName: categories.find(category => category.id === s.categoryId)?.name ?? 'Other',
    rateAmount: String(p.rateAmount), rateUnit: p.rateUnit,
    minimumQuantity: p.minimumQuantity, maximumQuantity: p.maximumQuantity,
    minimumCharge: String(p.minimumCharge), currency: 'INR',
  };
}

/* ---------------- REAL: profile + platforms ---------------- */
export const customerApi = {
  profile: () => call<CustomerProfile>(`${V1}/customer/profile`),
  platforms: () => call<PlatformDto[]>(`${V1}/catalog/platforms`),

  /* ---------------- IMPLEMENTED Phase 2 catalogue ---------------- */
  categories: () => call<CatalogCategory[]>(`${V1}/catalog/categories`),
  services: async (filters: { platformCode?: string; categoryId?: number | null; q?: string; page?: number; size?: number }): Promise<Page<CatalogService>> => {
    const platforms = await call<PlatformDto[]>(`${V1}/catalog/platforms`);
    const id = filters.platformCode ? platforms.find(p => p.code === filters.platformCode)?.id : undefined;
    if (filters.platformCode && id === undefined) return { items: [], page: 0, size: 24, totalItems: 0, totalPages: 0 };
    const categories = await call<CatalogCategory[]>(`${V1}/catalog/categories`);
    const services = await call<ServiceDto[]>(`${V1}/catalog/services${qs({ platformId: id, categoryId: filters.categoryId, search: filters.q })}`);
    const start = (filters.page ?? 0) * (filters.size ?? 24);
    const pageRows = services.slice(start, start + (filters.size ?? 24));
    // Backend Phase 2 service DTO deliberately excludes prices. Load each published price version via its real endpoint.
    const items = await Promise.all(pageRows.map(async s => {
      const price = await call<PriceDto>(`${V1}/catalog/services/${s.publicId}/price`);
      return mergeCatalogService(s, price, platforms, categories);
    }));
    return { items, page: filters.page ?? 0, size: filters.size ?? 24, totalItems: services.length, totalPages: Math.ceil(services.length / (filters.size ?? 24)) };
  },
  service: async (publicId: string): Promise<CatalogService> => {
    const [s, p, ins, platforms, categories] = await Promise.all([
      call<ServiceDto>(`${V1}/catalog/services/${publicId}`),
      call<PriceDto>(`${V1}/catalog/services/${publicId}/price`),
      call<InputDto[]>(`${V1}/catalog/services/${publicId}/inputs`),
      call<PlatformDto[]>(`${V1}/catalog/platforms`),
      call<CatalogCategory[]>(`${V1}/catalog/categories`),
    ]);
    return { ...mergeCatalogService(s, p, platforms, categories), inputs: ins.filter(i => i.active).map(i => ({
      inputKey: i.inputKey, label: i.label, inputType: i.inputType, required: i.required,
      helpText: i.helpText || undefined, maxLength: i.maxLength || undefined, allowedValues: i.allowedValues || [],
    })) };
  },
  pricePreview: (publicId: string, quantity: number) => call<PricePreview>(`${V1}/catalog/services/${publicId}/price-preview${qs({ quantity })}`),

  /* ---------------- Phase 3 wallet APIs + later-phase planned customer APIs ---------------- */
  quote: (b: { servicePublicId: string; quantity: number }) => call<Quote>(`${V1}/customer/orders/quotes`, post(b)),
  createOrder: (b: { quoteId: string; inputs: Record<string, string>; customerNote?: string }, key: string) => call<OrderDto>(`${V1}/customer/orders`, post(b, { 'Idempotency-Key': key })).then(normalizeOrder),
  orders: async (f: { status?: string; q?: string; page?: number; size?: number }) => { const raw = await call<any>(`${V1}/customer/orders${qs({page: f.page, size: f.size ?? 20})}`);const page = normalizePage<OrderDto>(raw, normalizeOrder); return {...page,items: f.status ? page.items.filter(o=>o.status===f.status) : page.items}; },
  order: async (orderNumber: string) => {const detail = await call<OrderDetail>(`${V1}/customer/orders/${encodeURIComponent(orderNumber)}`);return {...normalizeOrder(detail.order),timeline:(detail.history ?? []).map(h=>({toStatus:h.toStatus,note:h.note,createdAt:h.at}))};},
  // Phase 3 endpoints from WalletBalanceController + PaymentController.
  walletSummary: () => call<WalletSummary>(`${V1}/customer/wallet/balance`),
  initializeWallet: () => call<WalletSummary>(`${V1}/customer/wallet/initialize`, post()),
  ledger: async (page = 0) => normalizePage<LedgerRow>(await call<any>(`${V1}/customer/wallet/ledger${qs({ page, size: 20 })}`)), 
  // The caller retains the same idempotency key if the network response is uncertain.
  createTopup: (amount: string, idempotencyKey: string) => call<CreateTopupResponse>(`${V1}/customer/wallet/topups`, post({ amount }, { 'Idempotency-Key': idempotencyKey })),
  // Backend MUST authenticate customer ownership, verify the HMAC using its saved order ID,
  // fetch the Razorpay payment server-to-server, check captured/amount/currency/order and
  // atomically post a double-entry wallet credit exactly once. Browser cannot do this.
  verifyTopup: (request: VerifyTopupRequest) => call<VerifyTopupResponse>(`${V1}/customer/wallet/topups/verify`, post(request)),
  topup: (topupNumber: string) => call<TopupDto>(`${V1}/customer/wallet/topups/${topupNumber}`),
  tickets: () => call<Page<TicketDto>>(`${V1}/customer/support/tickets`),
  ticket: (n: string) => call<TicketDto>(`${V1}/customer/support/tickets/${n}`),
  createTicket: (b: { subject: string; category: string; message: string; orderNumber?: string }) => call<TicketDto>(`${V1}/customer/support/tickets`, post(b, idem())),
  replyTicket: (n: string, messageText: string) => call<TicketDto>(`${V1}/customer/support/tickets/${n}/messages`, post({ messageText })),
  announcements: () => call<AnnouncementDto[]>(`${V1}/customer/announcements`),
};

export const toE164 = (raw: string) => { const t = raw.trim(); return t.startsWith('+') ? `+${t.replace(/\D/g, '')}` : `+91${t.replace(/\D/g, '')}`; };
export const E164 = /^\+[1-9][0-9]{7,14}$/;
export const inr = (v: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(v));
export const when = (iso?: string | null) => iso ? new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—';
