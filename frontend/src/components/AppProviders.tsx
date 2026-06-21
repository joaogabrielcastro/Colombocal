'use client';

import { Toaster } from 'sonner';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FormEnterNavigation from '@/components/FormEnterNavigation';

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

  return (
    <QueryClientProvider client={queryClient}>
      <FormEnterNavigation />
      {children}
      <Toaster richColors closeButton position="top-right" />
    </QueryClientProvider>
  );
}
