export const API_BASE = '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function isRetryableStatus(status: number): boolean {
  return [408, 429, 502, 503, 504].includes(status);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function parseJsonSafe(text: string): Promise<unknown> {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

type FetchOptions = RequestInit & { retries?: number };

function messageFromErrorBody(body: unknown, status: number): string {
  if (body && typeof body === 'object' && body !== null && 'error' in body) {
    const e = (body as { error?: unknown }).error;
    if (e != null) return String(e);
  }
  if (typeof body === 'string' && body) return body;
  return `Erro ${status}`;
}

/**
 * GET/POST etc. com retentativas em falhas transitórias (rede, 502/503/504, 429).
 * Erros 4xx definitivos (exceto 408/429) não repetem a chamada.
 */
export async function apiFetch<T>(path: string, options?: FetchOptions): Promise<T> {
  const maxRetries = options?.retries ?? 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        ...options,
      });
      const text = await res.text();
      const parsed = await parseJsonSafe(text);

      if (!res.ok) {
        const err = new ApiError(
          messageFromErrorBody(parsed, res.status),
          res.status,
          parsed,
        );
        const canRetry =
          attempt < maxRetries && isRetryableStatus(res.status);
        if (!canRetry) throw err;
        await sleep(320 * (attempt + 1));
        continue;
      }

      return (parsed ?? null) as T;
    } catch (e) {
      if (e instanceof ApiError) {
        if (!isRetryableStatus(e.status)) throw e;
        if (attempt >= maxRetries) throw e;
        await sleep(320 * (attempt + 1));
        continue;
      }
      if (attempt >= maxRetries) throw e;
      await sleep(320 * (attempt + 1));
    }
  }

  throw new Error('Falha na requisição');
}

export async function apiFetchWithMeta<T>(
  path: string,
  options?: FetchOptions,
): Promise<{ data: T; meta: { totalCount: number | null; pageSize: number | null; pageOffset: number | null } }> {
  const maxRetries = options?.retries ?? 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        ...options,
      });
      const text = await res.text();
      const parsed = await parseJsonSafe(text);

      if (!res.ok) {
        const err = new ApiError(
          messageFromErrorBody(parsed, res.status),
          res.status,
          parsed,
        );
        const canRetry =
          attempt < maxRetries && isRetryableStatus(res.status);
        if (!canRetry) throw err;
        await sleep(320 * (attempt + 1));
        continue;
      }

      const parseHeaderInt = (name: string) => {
        const v = res.headers.get(name);
        if (v == null) return null;
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? null : n;
      };

      return {
        data: parsed as T,
        meta: {
          totalCount: parseHeaderInt('x-total-count'),
          pageSize: parseHeaderInt('x-page-size'),
          pageOffset: parseHeaderInt('x-page-offset'),
        },
      };
    } catch (e) {
      if (e instanceof ApiError) {
        if (!isRetryableStatus(e.status)) throw e;
        if (attempt >= maxRetries) throw e;
        await sleep(320 * (attempt + 1));
        continue;
      }
      if (attempt >= maxRetries) throw e;
      await sleep(320 * (attempt + 1));
    }
  }

  throw new ApiError('Falha após retentativas', 0);
}

export const api = {
  get: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  getWithMeta: <T>(path: string, options?: FetchOptions) =>
    apiFetchWithMeta<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

export default api;
