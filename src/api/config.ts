export const API_CONTRACT_VERSION = '1.0.0' as const;

const configuredVersion = import.meta.env.VITE_API_CONTRACT_VERSION ?? API_CONTRACT_VERSION;

if (configuredVersion !== API_CONTRACT_VERSION) {
  throw new Error(
    `Frontend contract ${API_CONTRACT_VERSION} cannot use backend contract ${configuredVersion}`,
  );
}

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const apiConfig = {
  baseUrl: rawBaseUrl.replace(/\/$/, ''),
  contractVersion: API_CONTRACT_VERSION,
  timeoutMs: Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS ?? 10_000),
} as const;
