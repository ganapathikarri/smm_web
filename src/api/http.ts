import { getApiUrl } from './config';

let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => { accessToken = token; };

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message); this.name = 'ApiError'; this.status = status; this.body = body;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(getApiUrl(path), {
    ...options,
    headers,
    credentials: 'include', // required for HttpOnly admin refresh cookies
  });
  const raw = await response.text();
  let parsed: any = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
  if (!response.ok) {
    const message = parsed?.message || parsed?.error || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, parsed);
  }
  return parsed as T;
}

export function unwrap<T>(payload: any): T {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data as T;
  return payload as T;
}
