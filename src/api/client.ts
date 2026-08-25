import { apiConfig } from './config';
import type { ErrorEnvelope } from './types';

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  authenticated?: boolean;
  retryReads?: boolean;
  timeoutMs?: number;
}

export class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private sessionExpiredListeners = new Set<() => void>();

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken() {
    return this.accessToken;
  }

  onSessionExpired(listener: () => void) {
    this.sessionExpiredListeners.add(listener);
    return () => {
      this.sessionExpiredListeners.delete(listener);
    };
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method?.toUpperCase() ?? 'GET';
    const authenticated = options.authenticated ?? true;
    const canRetry = method === 'GET' && (options.retryReads ?? true);
    let attempt = 0;
    let refreshed = false;

    while (true) {
      try {
        const response = await this.fetch(path, options, authenticated);

        if (response.status === 401 && authenticated && !refreshed) {
          refreshed = true;
          if (await this.refresh()) continue;
          this.expireSession();
        }

        if (!response.ok) {
          if (canRetry && RETRYABLE_STATUSES.has(response.status) && attempt < 2) {
            await delay(250 * 2 ** attempt, options.signal);
            attempt += 1;
            continue;
          }
          throw await toApiError(response);
        }

        if (response.status === 204) return undefined as T;
        const responseText = await response.text();
        if (!responseText) return undefined as T;
        try {
          return JSON.parse(responseText) as T;
        } catch {
          throw new ApiError(
            response.status,
            'invalid_response',
            'The server returned an invalid response.',
          );
        }
      } catch (error) {
        if (error instanceof ApiError || isAbortError(error) || !canRetry || attempt >= 2)
          throw error;
        await delay(250 * 2 ** attempt, options.signal);
        attempt += 1;
      }
    }
  }

  async openEventStream(path: string, lastEventId: number, signal: AbortSignal) {
    const headers = new Headers({
      Accept: 'text/event-stream',
      'Last-Event-ID': String(lastEventId),
      'X-WatchTrace-Contract-Version': apiConfig.contractVersion,
    });
    if (this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`);

    let response = await fetch(`${apiConfig.baseUrl}${path}`, {
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
    if (response.status === 401 && (await this.refresh())) {
      const token = this.accessToken;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      response = await fetch(`${apiConfig.baseUrl}${path}`, {
        headers,
        credentials: 'include',
        cache: 'no-store',
        signal,
      });
    }
    if (!response.ok || !response.body) throw await toApiError(response);
    return response.body;
  }

  async restoreSession() {
    return this.refresh();
  }

  private async fetch(path: string, options: RequestOptions, authenticated: boolean) {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? apiConfig.timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    headers.set('X-WatchTrace-Contract-Version', apiConfig.contractVersion);
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (authenticated && this.accessToken)
      headers.set('Authorization', `Bearer ${this.accessToken}`);

    return fetch(`${apiConfig.baseUrl}${path}`, {
      ...options,
      headers,
      signal,
      credentials: 'include',
      cache: 'no-store',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  }

  private async refresh(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      try {
        const response = await this.fetch('/auth/refresh', { method: 'POST' }, false);
        if (!response.ok) {
          this.accessToken = null;
          return false;
        }
        const body = (await response.json()) as { session: { token: string } };
        this.accessToken = body.session.token;
        return true;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  private expireSession() {
    this.accessToken = null;
    this.sessionExpiredListeners.forEach((listener) => listener());
  }
}

async function toApiError(response: Response) {
  let envelope: ErrorEnvelope | null = null;
  try {
    envelope = (await response.json()) as ErrorEnvelope;
  } catch {
    // Deliberately use a safe generic message for non-contract responses.
  }
  const retryAfter = Number(response.headers.get('Retry-After'));
  return new ApiError(
    response.status,
    envelope?.error.code ?? 'request_failed',
    envelope?.error.message ?? 'The request could not be completed.',
    envelope?.error.request_id,
    Number.isFinite(retryAfter) ? retryAfter : undefined,
  );
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

function delay(milliseconds: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new DOMException('The request was aborted', 'AbortError'),
        );
      },
      { once: true },
    );
  });
}

export const apiClient = new ApiClient();
