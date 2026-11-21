/** Phase 2 API client: paths and DTO properties are verified against the paired Spring Boot controllers. */
import { apiRequest, unwrap } from './http';

export type PlatformDto = { id: number; code: string; name: string; officialPolicyUrl: string | null; status: 'ACTIVE' | 'DISABLED'; createdAt: string; updatedAt: string };
export type CategoryDto = { id: number; platformId: number | null; parentId: number | null; name: string; slug: string; sortOrder: number; status: 'ACTIVE' | 'DISABLED'; createdAt: string; updatedAt: string };
export type ServiceDto = { id: number; publicId: string; serviceCode: string; platformId: number | null; categoryId: number; name: string; description: string; fulfilmentMode: 'MANUAL'; status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'RETIRED'; policyStatus: 'REVIEW_REQUIRED' | 'APPROVED' | 'SUSPENDED' | 'REJECTED'; policyReviewedAt: string | null; policyReviewedBy: number | null; policyReferenceUrl: string | null; policyReviewNotes: string | null; createdAt: string; updatedAt: string };
export type InputType = 'URL' | 'TEXT' | 'NUMBER' | 'SELECT';
export type InputDto = { id: number; serviceId: number; inputKey: string; label: string; inputType: InputType; required: boolean; helpText: string | null; maxLength: number | null; minNumber: number | null; maxNumber: number | null; allowedValues: string[] | null; sortOrder: number; active: boolean };
export type RateUnit = 'PER_UNIT' | 'PER_1000' | 'FIXED';
export type TaxMode = 'NOT_CONFIGURED' | 'NONE' | 'EXCLUSIVE' | 'INCLUSIVE';
export type PriceDto = { id: number; serviceId: number; versionNo: number; rateAmount: number; rateUnit: RateUnit; fixedPackageQuantity: number | null; minimumQuantity: number; maximumQuantity: number; minimumCharge: number; taxMode: TaxMode; taxRatePercent: number | null; currencyCode: string; roundingMode: string; effectiveFrom: string; effectiveTo: string | null; createdAt: string };
export type PricePreview = { priceVersionId: number; quantity: number; currencyCode: string; subtotal: number; taxAmount: number; total: number };

const V1 = '/api/v1';
const call = async <T>(path: string, init?: RequestInit): Promise<T> => unwrap<T>(await apiRequest<unknown>(path, init));
const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });
const query = (filters: Record<string, string | number | null | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') params.set(key, String(value)); });
  return params.size ? `?${params.toString()}` : '';
};

export const catalogApi = {
  platforms: () => call<PlatformDto[]>(`${V1}/admin/catalog/platforms`),
  createPlatform: (data: { code: string; name: string; officialPolicyUrl: string | null }) => call<PlatformDto>(`${V1}/admin/catalog/platforms`, json('POST', data)),
  updatePlatform: (id: number, data: { name: string; officialPolicyUrl: string | null }) => call<PlatformDto>(`${V1}/admin/catalog/platforms/${id}`, json('PUT', data)),
  platformStatus: (id: number, status: 'ACTIVE' | 'DISABLED', reason: string) => call<PlatformDto>(`${V1}/admin/catalog/platforms/${id}/status`, json('PATCH', { status, reason })),
  categories: (platformId?: number) => call<CategoryDto[]>(`${V1}/admin/catalog/categories${query({ platformId })}`),
  createCategory: (data: { platformId: number | null; parentId: number | null; name: string; slug: string; sortOrder: number }) => call<CategoryDto>(`${V1}/admin/catalog/categories`, json('POST', data)),
  updateCategory: (id: number, data: { platformId: number | null; parentId: number | null; name: string; slug: string; sortOrder: number }) => call<CategoryDto>(`${V1}/admin/catalog/categories/${id}`, json('PUT', data)),
  categoryStatus: (id: number, status: 'ACTIVE' | 'DISABLED', reason: string) => call<CategoryDto>(`${V1}/admin/catalog/categories/${id}/status`, json('PATCH', { status, reason })),
  services: (filters: { platformId?: number | null; categoryId?: number | null; search?: string } = {}) => call<ServiceDto[]>(`${V1}/admin/catalog/services${query(filters)}`),
  createService: (data: { serviceCode: string; platformId: number | null; categoryId: number; name: string; description: string }) => call<ServiceDto>(`${V1}/admin/catalog/services`, json('POST', data)),
  updateService: (id: number, data: { platformId: number | null; categoryId: number; name: string; description: string }) => call<ServiceDto>(`${V1}/admin/catalog/services/${id}`, json('PUT', data)),
  reviewService: (id: number, data: { policyStatus: 'APPROVED' | 'SUSPENDED' | 'REJECTED'; policyReferenceUrl: string | null; reviewNotes: string; confirmedCompliant: boolean }) => call<ServiceDto>(`${V1}/admin/catalog/services/${id}/policy`, json('PATCH', data)),
  serviceStatus: (id: number, status: 'ACTIVE' | 'PAUSED' | 'RETIRED', reason: string) => call<ServiceDto>(`${V1}/admin/catalog/services/${id}/status`, json('PATCH', { status, reason })),
  inputs: (serviceId: number) => call<InputDto[]>(`${V1}/admin/catalog/services/${serviceId}/inputs`),
  createInput: (serviceId: number, data: InputWrite & { inputKey: string }) => call<InputDto>(`${V1}/admin/catalog/services/${serviceId}/inputs`, json('POST', data)),
  updateInput: (serviceId: number, id: number, data: InputWrite) => call<InputDto>(`${V1}/admin/catalog/services/${serviceId}/inputs/${id}`, json('PUT', data)),
  inputStatus: (serviceId: number, id: number, active: boolean, reason: string) => call<InputDto>(`${V1}/admin/catalog/services/${serviceId}/inputs/${id}/status`, json('PATCH', { active, reason })),
  prices: (serviceId: number) => call<PriceDto[]>(`${V1}/admin/catalog/services/${serviceId}/prices`),
  addPrice: (serviceId: number, data: PriceWrite) => call<PriceDto>(`${V1}/admin/catalog/services/${serviceId}/prices`, json('POST', data)),
};

export type InputWrite = { label: string; inputType: InputType; required: boolean; helpText: string | null; maxLength: number | null; minNumber: number | null; maxNumber: number | null; allowedValues: string[] | null; sortOrder: number };
export type PriceWrite = { rateAmount: number; rateUnit: RateUnit; fixedPackageQuantity: number | null; minimumQuantity: number; maximumQuantity: number; minimumCharge: number; taxMode: TaxMode; taxRatePercent: number | null; changeReason: string };
