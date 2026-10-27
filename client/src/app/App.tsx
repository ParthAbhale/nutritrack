import { useEffect, useState } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ApiError, onSessionExpired } from '@/lib/api';
import { applyTheme, storedTheme } from '@/lib/theme';
import { keys } from '@/services/keys';
import { router } from './router';

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache(),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Retry transient failures only, with backoff; never retry client errors.
        retry: (count, err) => err instanceof ApiError && (err.isNetwork || err.status >= 500) && err.code !== 'PROVIDER_UNAVAILABLE' && count < 2,
        retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
      },
      // Mutations are never retried automatically (they may not be idempotent).
      mutations: { retry: false },
    },
  });
}

export function App() {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    applyTheme(storedTheme());
    return onSessionExpired(() => {
      // Only an existing signed-in session can "expire"; anonymous 401s are normal.
      if (!queryClient.getQueryData(keys.me)) return;
      queryClient.clear();
      queryClient.setQueryData(keys.me, null);
      if (!['/login', '/register', '/'].includes(window.location.pathname)) {
        void router.navigate(`/login?reason=expired&next=${encodeURIComponent(window.location.pathname)}`, { replace: true });
      }
    });
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton toastOptions={{ className: 'font-sans' }} />
    </QueryClientProvider>
  );
}
