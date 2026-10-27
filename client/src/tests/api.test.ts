import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, onSessionExpired, request, setCsrfToken } from '@/lib/api';
import { mockFetch } from './utils';

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfToken(null);
});

describe('api client', () => {
  it('fetches a CSRF token once and sends it on mutations only', async () => {
    const { calls } = mockFetch({
      'GET /auth/csrf': () => ({ body: { data: { csrfToken: 'tok.sig' } } }),
      'POST /goals': () => ({ status: 201, body: { data: { ok: true } } }),
      'GET /goals': () => ({ body: { data: null } }),
    });
    await api.post('/goals', { calories: 2000 });
    await api.data('/goals');
    await api.post('/goals', {});
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts.every((c) => (c.init?.headers as Record<string, string>)['X-CSRF-Token'] === 'tok.sig')).toBe(true);
    expect(calls.filter((c) => c.url.pathname.endsWith('/auth/csrf'))).toHaveLength(1);
    const get = calls.find((c) => c.method === 'GET' && c.url.pathname.endsWith('/goals'))!;
    expect((get.init?.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined();
    expect(get.init?.credentials).toBe('include');
  });

  it('refreshes once on 401 and retries the original request', async () => {
    setCsrfToken('t');
    let first = true;
    const { calls } = mockFetch({
      'GET /diary': () => {
        if (first) {
          first = false;
          return { status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'expired' } } };
        }
        return { body: { data: { ok: 1 } } };
      },
      'POST /auth/refresh': () => ({ body: { data: { csrfToken: 'new' } } }),
    });
    await expect(api.data('/diary', { date: '2026-10-27' })).resolves.toEqual({ ok: 1 });
    expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual(['GET /api/v1/diary', 'POST /api/v1/auth/refresh', 'GET /api/v1/diary']);
    expect(calls[2]!.url.searchParams.get('date')).toBe('2026-10-27');
  });

  it('notifies listeners when the session cannot be refreshed', async () => {
    setCsrfToken('t');
    mockFetch({
      'GET /users/me': () => ({ status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'no' } } }),
      'POST /auth/refresh': () => ({ status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'no' } } }),
    });
    const listener = vi.fn();
    const off = onSessionExpired(listener);
    await expect(api.data('/users/me')).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });

  it('maps error bodies, field errors and network failures', async () => {
    setCsrfToken('t');
    mockFetch({
      'POST /diary/entries': () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', message: 'Bad', details: [{ path: 'quantity', message: 'Too big' }], requestId: 'r1' } } }),
    });
    const err = (await api.post('/diary/entries', {}).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.fieldErrors()).toEqual({ quantity: 'Too big' });
    expect(err.requestId).toBe('r1');

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const net = (await request('/goals').catch((e) => e)) as ApiError;
    expect(net.code).toBe('NETWORK_ERROR');
    expect(net.isNetwork).toBe(true);
  });

  it('reports cancellation distinctly from network errors', async () => {
    vi.stubGlobal('fetch', vi.fn((_: unknown, init?: RequestInit) => new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))));
    const controller = new AbortController();
    const p = request('/foods/search', { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toMatchObject({ code: 'ABORTED' });
  });
});
