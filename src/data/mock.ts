export type Status = 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REVIEW_REQUIRED' | 'APPROVED' | 'SUSPENDED';
export type Platform = { id: number; code: string; name: string; status: 'ACTIVE' | 'DISABLED'; accent: string; initials: string; officialPolicyUrl?: string | null };
export type Category = { id: number; name: string; slug: string; platform: string; services: number; status: 'ACTIVE' | 'DISABLED'; updated: string };
export type Service = { id: number; code: string; name: string; category: string; platform: string; fulfilment: 'MANUAL'; policyStatus: 'APPROVED' | 'REVIEW_REQUIRED' | 'SUSPENDED'; status: 'ACTIVE' | 'PAUSED' | 'DRAFT'; price: number; unit: string; updated: string };
export type Order = { id: string; customer: string; service: string; platform: string; quantity: number; amount: number; status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'; date: string };
export type Customer = { id: string; name: string; email: string; orders: number; spent: number; status: 'ACTIVE' | 'PENDING_VERIFICATION' | 'BLOCKED'; joined: string };

export const seedPlatforms: Platform[] = [
  { id: 1, code: 'INSTAGRAM', name: 'Instagram', status: 'ACTIVE', accent: '#D94686', initials: 'IG' },
  { id: 2, code: 'YOUTUBE', name: 'YouTube', status: 'ACTIVE', accent: '#E34B4B', initials: 'YT' },
  { id: 3, code: 'FACEBOOK', name: 'Facebook', status: 'ACTIVE', accent: '#3978D5', initials: 'f' },
  { id: 4, code: 'LINKEDIN', name: 'LinkedIn', status: 'ACTIVE', accent: '#2F83B7', initials: 'in' },
  { id: 5, code: 'X', name: 'X', status: 'ACTIVE', accent: '#252B36', initials: 'X' },
  { id: 6, code: 'TIKTOK', name: 'TikTok', status: 'DISABLED', accent: '#31343A', initials: 'TT' },
];
export const seedCategories: Category[] = [
  { id: 1, name: 'Content & Creative', slug: 'content-creative', platform: 'All platforms', services: 8, status: 'ACTIVE', updated: 'Today, 09:42' },
  { id: 2, name: 'Account Strategy', slug: 'account-strategy', platform: 'All platforms', services: 5, status: 'ACTIVE', updated: 'Yesterday' },
  { id: 3, name: 'Video Production', slug: 'video-production', platform: 'YouTube', services: 4, status: 'ACTIVE', updated: 'Nov 13, 2026' },
  { id: 4, name: 'Community Management', slug: 'community-management', platform: 'Instagram', services: 3, status: 'ACTIVE', updated: 'Nov 12, 2026' },
  { id: 5, name: 'Paid Campaign Support', slug: 'paid-campaign-support', platform: 'All platforms', services: 2, status: 'DISABLED', updated: 'Nov 10, 2026' },
];
export const seedServices: Service[] = [
  { id: 101, code: 'IG-CONT-001', name: 'Instagram content calendar', category: 'Content & Creative', platform: 'Instagram', fulfilment: 'MANUAL', policyStatus: 'APPROVED', status: 'ACTIVE', price: 1499, unit: 'per month', updated: 'Today' },
  { id: 102, code: 'YT-EDIT-002', name: 'Short-form video editing', category: 'Video Production', platform: 'YouTube', fulfilment: 'MANUAL', policyStatus: 'APPROVED', status: 'ACTIVE', price: 799, unit: 'per video', updated: 'Today' },
  { id: 103, code: 'SM-STRAT-003', name: 'Social media strategy session', category: 'Account Strategy', platform: 'All platforms', fulfilment: 'MANUAL', policyStatus: 'APPROVED', status: 'ACTIVE', price: 1999, unit: 'per session', updated: 'Yesterday' },
  { id: 104, code: 'IG-COMM-004', name: 'Community moderation', category: 'Community Management', platform: 'Instagram', fulfilment: 'MANUAL', policyStatus: 'REVIEW_REQUIRED', status: 'DRAFT', price: 4999, unit: 'per month', updated: 'Nov 14, 2026' },
  { id: 105, code: 'LI-PROF-005', name: 'LinkedIn profile optimization', category: 'Account Strategy', platform: 'LinkedIn', fulfilment: 'MANUAL', policyStatus: 'APPROVED', status: 'PAUSED', price: 1299, unit: 'fixed', updated: 'Nov 13, 2026' },
  { id: 106, code: 'SM-CAMP-006', name: 'Campaign planning & reporting', category: 'Paid Campaign Support', platform: 'All platforms', fulfilment: 'MANUAL', policyStatus: 'APPROVED', status: 'ACTIVE', price: 3499, unit: 'per campaign', updated: 'Nov 12, 2026' },
];
export const seedOrders: Order[] = [
  { id: 'SMM-2841', customer: 'Aarav Sharma', service: 'Short-form video editing', platform: 'YouTube', quantity: 4, amount: 3196, status: 'IN_PROGRESS', date: 'Nov 15, 2026 · 09:24' },
  { id: 'SMM-2840', customer: 'Meera Reddy', service: 'Instagram content calendar', platform: 'Instagram', quantity: 1, amount: 1499, status: 'PENDING', date: 'Nov 15, 2026 · 08:52' },
  { id: 'SMM-2839', customer: 'Rohan Das', service: 'LinkedIn profile optimization', platform: 'LinkedIn', quantity: 1, amount: 1299, status: 'COMPLETED', date: 'Nov 14, 2026 · 17:12' },
  { id: 'SMM-2838', customer: 'Ananya Iyer', service: 'Social media strategy session', platform: 'All platforms', quantity: 1, amount: 1999, status: 'PENDING', date: 'Nov 14, 2026 · 15:40' },
  { id: 'SMM-2837', customer: 'Kabir Patel', service: 'Campaign planning & reporting', platform: 'All platforms', quantity: 1, amount: 3499, status: 'CANCELLED', date: 'Nov 14, 2026 · 13:06' },
];
export const seedCustomers: Customer[] = [
  { id: 'CUS-1094', name: 'Aarav Sharma', email: 'aarav@example.com', orders: 12, spent: 18450, status: 'ACTIVE', joined: 'Oct 21, 2026' },
  { id: 'CUS-1093', name: 'Meera Reddy', email: 'meera@example.com', orders: 8, spent: 12990, status: 'ACTIVE', joined: 'Oct 18, 2026' },
  { id: 'CUS-1092', name: 'Rohan Das', email: 'rohan@example.com', orders: 5, spent: 8640, status: 'ACTIVE', joined: 'Oct 15, 2026' },
  { id: 'CUS-1091', name: 'Ananya Iyer', email: 'ananya@example.com', orders: 3, spent: 5498, status: 'PENDING_VERIFICATION', joined: 'Nov 02, 2026' },
  { id: 'CUS-1090', name: 'Kabir Patel', email: 'kabir@example.com', orders: 1, spent: 3499, status: 'BLOCKED', joined: 'Nov 04, 2026' },
];
export const seedLedger = [
  { id: 'LED-5801', reference: 'PAY-77108', customer: 'Aarav Sharma', type: 'Wallet credit', direction: 'CREDIT', amount: 5000, status: 'Verified', date: 'Nov 15, 09:18' },
  { id: 'LED-5800', reference: 'ORD-2841', customer: 'Aarav Sharma', type: 'Order debit', direction: 'DEBIT', amount: 3196, status: 'Posted', date: 'Nov 15, 09:24' },
  { id: 'LED-5799', reference: 'PAY-77102', customer: 'Meera Reddy', type: 'Wallet credit', direction: 'CREDIT', amount: 2500, status: 'Verified', date: 'Nov 15, 08:43' },
  { id: 'LED-5798', reference: 'ORD-2839', customer: 'Rohan Das', type: 'Order debit', direction: 'DEBIT', amount: 1299, status: 'Posted', date: 'Nov 14, 17:12' },
];
export const seedAudit = [
  { actor: 'Super Admin', action: 'Updated service pricing', target: 'Short-form video editing', time: 'Today, 09:42', ip: '127.0.0.1' },
  { actor: 'Super Admin', action: 'Approved policy review', target: 'LinkedIn profile optimization', time: 'Yesterday, 18:16', ip: '127.0.0.1' },
  { actor: 'Super Admin', action: 'Paused platform', target: 'TikTok', time: 'Nov 13, 14:05', ip: '127.0.0.1' },
  { actor: 'Super Admin', action: 'Created category', target: 'Video Production', time: 'Nov 12, 11:33', ip: '127.0.0.1' },
];

export type PriceVersion = {
  id: number; serviceId: number; serviceName: string; versionNo: number;
  rateAmount: number; rateUnit: 'PER_1000' | 'PER_UNIT' | 'FIXED'; fixedPackageQuantity: number | null;
  minQuantity: number; maxQuantity: number; minCharge: number;
  taxMode: 'NOT_CONFIGURED' | 'EXCLUSIVE' | 'INCLUSIVE' | 'NONE'; currency: 'INR';
  effectiveFrom: string; createdBy: string;
};
export type ServiceInput = {
  id: number; serviceId: number; serviceName: string; inputKey: string; label: string;
  inputType: 'URL' | 'TEXT' | 'NUMBER' | 'SELECT'; required: boolean; helpText: string;
  maxLength: number | null; allowedValues: string[]; active: boolean;
};
export const seedPriceVersions: PriceVersion[] = [
  { id: 1, serviceId: 101, serviceName: 'Instagram content calendar', versionNo: 1, rateAmount: 1499, rateUnit: 'FIXED', fixedPackageQuantity: 1, minQuantity: 1, maxQuantity: 1, minCharge: 1499, taxMode: 'NOT_CONFIGURED', currency: 'INR', effectiveFrom: '2026-10-01', createdBy: 'Super Admin' },
  { id: 2, serviceId: 102, serviceName: 'Short-form video editing', versionNo: 2, rateAmount: 799, rateUnit: 'PER_UNIT', fixedPackageQuantity: null, minQuantity: 1, maxQuantity: 20, minCharge: 799, taxMode: 'NOT_CONFIGURED', currency: 'INR', effectiveFrom: '2026-11-01', createdBy: 'Super Admin' },
  { id: 3, serviceId: 103, serviceName: 'Social media strategy session', versionNo: 1, rateAmount: 1999, rateUnit: 'FIXED', fixedPackageQuantity: 1, minQuantity: 1, maxQuantity: 1, minCharge: 1999, taxMode: 'NOT_CONFIGURED', currency: 'INR', effectiveFrom: '2026-10-15', createdBy: 'Super Admin' },
];
export const seedServiceInputs: ServiceInput[] = [
  { id: 1, serviceId: 101, serviceName: 'Instagram content calendar', inputKey: 'profile_url', label: 'Instagram profile URL', inputType: 'URL', required: true, helpText: 'Public profile URL for content context.', maxLength: 500, allowedValues: [], active: true },
  { id: 2, serviceId: 101, serviceName: 'Instagram content calendar', inputKey: 'brand_notes', label: 'Brand notes', inputType: 'TEXT', required: false, helpText: 'Tone, audience and content preferences.', maxLength: 1000, allowedValues: [], active: true },
  { id: 3, serviceId: 102, serviceName: 'Short-form video editing', inputKey: 'video_url', label: 'Source video link', inputType: 'URL', required: true, helpText: 'Share a permitted source file link.', maxLength: 500, allowedValues: [], active: true },
];
