import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './client';

function response(status: number, body?: unknown, headers?: HeadersInit) {
  return new Response(body === undefined ? undefined : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('ApiClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shares one rotating-cookie refresh across concurrent 401 responses', async () => {
    const client = new ApiClient();
    client.setAccessToken('expired');
    let refreshes = 0;
    globalThis.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshes += 1;
        await Promise.resolve();
        return response(200, { session: { token: 'fresh' } });
      }
      const token = new Headers(init?.headers).get('Authorization');
      return token === 'Bearer fresh'
        ? response(200, { ok: true })
        : response(401, {
            error: { code: 'invalid_session', message: 'Session expired', request_id: 'req-1' },
          });
    }) as typeof fetch;

    await expect(
      Promise.all([
        client.request<{ ok: boolean }>('/one'),
        client.request<{ ok: boolean }>('/two'),
      ]),
    ).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshes).toBe(1);
    expect(client.getAccessToken()).toBe('fresh');
  });

  it('retries bounded safe reads but never retries mutations', async () => {
    const client = new ApiClient();
    const read = vi
      .fn()
      .mockResolvedValueOnce(
        response(503, { error: { code: 'busy', message: 'Busy', request_id: '1' } }),
      )
      .mockResolvedValueOnce(response(200, { value: 42 }));
    globalThis.fetch = read as typeof fetch;
    const result = await client.request<{ value: number }>('/report');
    expect(result.value).toBe(42);
    expect(read).toHaveBeenCalledTimes(2);

    const mutation = vi
      .fn()
      .mockResolvedValue(
        response(503, { error: { code: 'busy', message: 'Busy', request_id: '2' } }),
      );
    globalThis.fetch = mutation as typeof fetch;
    await expect(
      client.request('/monitor', { method: 'POST', body: { name: 'API' } }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(mutation).toHaveBeenCalledTimes(1);
  });

  it('keeps the refresh cookie credentialed and tokens out of browser storage', async () => {
    const client = new ApiClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(200, { session: { token: 'memory-only' } }));
    globalThis.fetch = fetchMock as typeof fetch;
    expect(await client.restoreSession()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
  });

  it('exposes safe contract errors with rate-limit context', async () => {
    const client = new ApiClient();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        response(
          429,
          { error: { code: 'rate_limited', message: 'Too many requests', request_id: 'req-safe' } },
          { 'Retry-After': '17' },
        ),
      ) as typeof fetch;
    const error = await client.request('/dashboard').catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      status: 429,
      code: 'rate_limited',
      requestId: 'req-safe',
      retryAfterSeconds: 17,
    });
  });

  it('accepts successful empty responses even when content-length is omitted', async () => {
    const client = new ApiClient();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 202 })) as typeof fetch;
    await expect(
      client.request<void>('/auth/forgot-password', {
        method: 'POST',
        authenticated: false,
        body: { email: 'owner@example.com' },
      }),
    ).resolves.toBeUndefined();
  });
});
