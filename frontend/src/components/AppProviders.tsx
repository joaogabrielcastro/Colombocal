'use client';

import { Toaster } from 'sonner';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FormEnterNavigation from '@/components/FormEnterNavigation';
import { AUTH_SESSION_EVENT } from '@/lib/auth-token';

export default function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    const onAuthChange = () => {
      queryClient.clear();
    };
    window.addEventListener(AUTH_SESSION_EVENT, onAuthChange);
    return () => window.removeEventListener(AUTH_SESSION_EVENT, onAuthChange);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <FormEnterNavigation />
      {children}
      <Toaster richColors closeButton position="top-right" />
    </QueryClientProvider>
  );
}
