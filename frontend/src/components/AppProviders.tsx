'use client';

import { Toaster } from 'sonner';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FormEnterNavigation from '@/components/FormEnterNavigation';
import { AUTH_SESSION_EVENT, getAuthTenantId } from '@/lib/auth-token';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Multi-tenant: nunca reutilizar lista de outro tenant sem refetch
        staleTime: 0,
        gcTime: 0,
        retry: 1,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false,
      },
    },
  });
}

export default function AppProviders({ children }: { children: ReactNode }) {
  // tenantKey estável no SSR; sincroniza com JWT só no client após mount
  const [tenantKey, setTenantKey] = useState(0);
  const [queryClient, setQueryClient] = useState(() => createQueryClient());

  const resetSessionCaches = useCallback(() => {
    const tid = getAuthTenantId() ?? 0;
    setTenantKey(tid);
    setQueryClient((prev) => {
      prev.clear();
      return createQueryClient();
    });
  }, []);

  useEffect(() => {
    setTenantKey(getAuthTenantId() ?? 0);
    window.addEventListener(AUTH_SESSION_EVENT, resetSessionCaches);
    window.addEventListener('storage', resetSessionCaches);
    return () => {
      window.removeEventListener(AUTH_SESSION_EVENT, resetSessionCaches);
      window.removeEventListener('storage', resetSessionCaches);
    };
  }, [resetSessionCaches]);

  return (
    <QueryClientProvider client={queryClient} key={`qc-${tenantKey}`}>
      <FormEnterNavigation />
      {children}
      <Toaster richColors closeButton position="top-right" />
    </QueryClientProvider>
  );
}
