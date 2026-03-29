'use client';

import { Toaster } from 'sonner';
import type { ReactNode } from 'react';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster richColors closeButton position="top-right" />
    </>
  );
}
