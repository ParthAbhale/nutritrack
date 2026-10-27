import type { ApiErrorBody, ApiErrorCode } from '@nutritrack/shared';

/**
 * Fetch wrapper for /api/v1.
 *  - Sends cookies (HttpOnly auth cookies are never readable from JS).
 *  - Adds the CSRF token (kept in memory only) to mutating requests.
 *  - On 401, performs one single-flight refresh and retries the request once.
 *  - Applies a timeout and merges caller abort signals (stale searches).
 */
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api/v1';
const DEFAULT_TIMEOUT_MS = 20_000;

export type ClientErrorCode = ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'ABORTED';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ClientErrorCode,
    message: string,
    public readonly details: ApiErrorBody['details'] = [],
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isNetwork() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }
  fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.details ?? []).map((d) => [d.path, d.message]));
  }
}

let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;
let refreshPromise: Promise<boolean> | null = null;
const sessionListeners = new Set<() => void>();

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

/** Called when the session can't be refreshed (expired, revoked, or reused token). */
export function onSessionExpired(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

async function getCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  csrfPromise ??= fetch(`${BASE}/auth/csrf`, { credentials: 'include' })
    .then((r) => r.json())
    .then((j: { data: { csrfToken: string } }) => (csrfToken = j.data.csrfToken))
    .finally(() => (csrfPromise = null));
  return csrfPromise;
}

async function refreshSession(): Promise<boolean> {
  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': await getCsrf() },
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { data: { csrfToken: string } };
      setCsrfToken(json.data.csrfToken);
      return true;
    } catch {
      return false;
    }
  })().finally(() => (refreshPromise = null));
  return refreshPromise;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Return the raw Response (downloads). */
  raw?: boolean;
}

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/csrf'];

function buildUrl(path: string, query?: RequestOptions['query']) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return `${BASE}${path}${s ? `?${s}` : ''}`;
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRF-Token'] = await getCsrf();
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  try {
    return await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      credentials: 'include',
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw new ApiError(0, 'ABORTED', 'Request cancelled');
    if (timeout.aborted) throw new ApiError(0, 'TIMEOUT', 'The server took too long to respond. Check your connection and try again.');
    void err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.');
  }
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const json = (await res.json()) as { error?: ApiErrorBody };
    if (json.error) return new ApiError(res.status, json.error.code, json.error.message, json.error.details, json.error.requestId);
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, res.status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR', `Request failed (${res.status})`);
}

export async function request<T, M = undefined>(path: string, opts: RequestOptions = {}): Promise<{ data: T; meta?: M; response: Response }> {
  let res = await send(path, opts);

  if (res.status === 403) {
    const err = await toError(res.clone());
    if (err.code === 'CSRF_INVALID') {
      setCsrfToken(null);
      res = await send(path, opts);
    }
  }
  if (res.status === 401 && !NO_REFRESH.includes(path)) {
    const refreshed = await refreshSession();
    if (refreshed) res = await send(path, opts);
    else sessionListeners.forEach((l) => l());
  }
  if (!res.ok) throw await toError(res);
  if (opts.raw) return { data: undefined as T, response: res };
  if (res.status === 204) return { data: undefined as T, response: res };
  const json = (await res.json()) as { data: T; meta?: M };
  return { data: json.data, meta: json.meta, response: res };
}

export const api = {
  data: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) => request<T>(path, { query, signal }).then((r) => r.data),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }).then((r) => r.data),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }).then((r) => r.data),
  del: <T = void>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }).then((r) => r.data),
};

/** Downloads an authenticated file (CSV/JSON export) without exposing tokens in URLs. */
export async function downloadFile(path: string, query: RequestOptions['query'], fallbackName: string) {
  const { response } = await request(path, { query, raw: true, timeoutMs: 60_000 });
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) return err.message;
  return fallback;
}
