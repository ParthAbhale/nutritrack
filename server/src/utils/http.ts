import { AppError } from './errors';

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

interface FetchJsonOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
  retries?: number;
  signal?: AbortSignal;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * JSON fetch for external providers: timeout, bounded retries with exponential
 * backoff for transient failures (network, 429, 5xx) on idempotent reads only.
 */
export async function fetchJson(url: string, opts: FetchJsonOptions): Promise<unknown> {
  const retries = opts.retries ?? 1;
  let attempt = 0;
  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), opts.timeoutMs);
    const onAbort = () => controller.abort(opts.signal?.reason);
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers: { Accept: 'application/json', ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...opts.headers },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
        redirect: 'error',
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        throw new UpstreamError(`Upstream responded ${res.status}`, res.status, retryable);
      }
      const type = res.headers.get('content-type') ?? '';
      if (!type.includes('json')) throw new UpstreamError('Upstream returned a non-JSON response', res.status, true);
      return await res.json();
    } catch (err) {
      if (opts.signal?.aborted) throw new AppError(499 as number, 'PROVIDER_UNAVAILABLE', 'Request cancelled');
      const upstream =
        err instanceof UpstreamError ? err : new UpstreamError(err instanceof Error ? err.message : 'Network error', null, true);
      if (!upstream.retryable || attempt >= retries) throw upstream;
      attempt += 1;
      await sleep(250 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }
  }
}
