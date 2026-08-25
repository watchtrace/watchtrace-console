import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: (failureCount, error) =>
        failureCount < 2 && (!(error instanceof ApiError) || error.status >= 500),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
