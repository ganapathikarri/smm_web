const env = import.meta.env;

export const isDemoMode = String(env.VITE_DEMO_MODE ?? 'false').toLowerCase() === 'true';
export const apiBaseUrl = String(env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const apiPaths = {
  adminLogin: env.VITE_ADMIN_LOGIN_PATH || '/api/v1/admin/auth/login',
  adminMfaVerify: env.VITE_ADMIN_MFA_VERIFY_PATH || '/api/v1/admin/auth/mfa/verify',
  adminRefresh: env.VITE_ADMIN_REFRESH_PATH || '/api/v1/admin/auth/refresh',
  adminLogout: env.VITE_ADMIN_LOGOUT_PATH || '/api/v1/admin/auth/logout',
  platforms: env.VITE_ADMIN_PLATFORMS_PATH || '/api/v1/admin/catalog/platforms',
  categories: '/api/v1/admin/catalog/categories',
  services: '/api/v1/admin/catalog/services',
  priceVersions: (serviceId: number) => `/api/v1/admin/catalog/services/${serviceId}/prices`,
  serviceInputs: (serviceId: number) => `/api/v1/admin/catalog/services/${serviceId}/inputs`,
  orders: '/api/v1/admin/orders',
  customers: '/api/v1/admin/customers',
  walletSummary: '/api/v1/admin/wallet/summary',
  payments: '/api/v1/admin/payments',
  policyReviews: '/api/v1/admin/policy-reviews',
  reports: '/api/v1/admin/reports',
  auditLogs: '/api/v1/admin/audit-logs',
} as const;

export const getApiUrl = (path: string) => `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
