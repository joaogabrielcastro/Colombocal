'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { getAuthToken } from '@/lib/auth-token';

/**
 * Quando true, exige JWT (alinhado ao backend sem AUTH_DISABLED).
 * Em desenvolvimento com backend em AUTH_DISABLED, deixe false.
 */
const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === 'true';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';
  const isSetup = pathname === '/setup';
  const isCadastro = pathname === '/cadastro';
  const isPublicShell = isLogin || isSetup || isCadastro;

  useEffect(() => {
    if (!requireLogin) return;
    if (!isPublicShell && !getAuthToken()) {
      router.replace('/login');
    }
    if (isLogin && getAuthToken()) {
      router.replace('/');
    }
    if (isSetup && getAuthToken()) {
      router.replace('/');
    }
    if (isCadastro && getAuthToken()) {
      router.replace('/');
    }
  }, [isLogin, isSetup, isCadastro, isPublicShell, pathname, router]);

  if (isPublicShell) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
