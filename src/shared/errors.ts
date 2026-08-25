import { ApiError } from '../api/client';

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const suffix = error.requestId ? ` Reference: ${error.requestId}` : '';
    if (error.status === 429 && error.retryAfterSeconds) {
      return `${error.message} Try again in ${error.retryAfterSeconds} seconds.${suffix}`;
    }
    return `${error.message}${suffix}`;
  }
  return 'Something went wrong. Check your connection and try again.';
}
