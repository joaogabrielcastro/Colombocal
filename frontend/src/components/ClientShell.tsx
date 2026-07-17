'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import BrandLogo from '@/components/BrandLogo';
import { AUTH_SESSION_EVENT, getAuthTenantId, getAuthToken } from '@/lib/auth-token';

/**
 * Por omissão exige JWT: rotas internas redirecionam para /login sem token.
 * Para desligar (ex.: dev com backend em AUTH_DISABLED): NEXT_PUBLIC_REQUIRE_LOGIN=false
 */
const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN !== 'false';

function initialAllowBody(pathname: string): boolean {
  const isPublic =
    pathname === '/login' ||
    pathname === '/setup' ||
    pathname === '/cadastro';
  if (isPublic || !requireLogin) return true;
  return false;
}

function sessionKeyFromToken() {
  return `tenant-${getAuthTenantId() ?? 'none'}`;
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';
  const isSetup = pathname === '/setup';
  const isCadastro = pathname === '/cadastro';
  const isPublicShell = isLogin || isSetup || isCadastro;

  const [allowBody, setAllowBody] = useState(() => initialAllowBody(pathname));
  const [sessionKey, setSessionKey] = useState(sessionKeyFromToken);

  useEffect(() => {
    const refreshSessionKey = () => {
      setSessionKey(`${sessionKeyFromToken()}-${Date.now()}`);
    };
    // Sincroniza se o token já mudou (ex.: login na mesma aba)
    setSessionKey(sessionKeyFromToken());
    window.addEventListener(AUTH_SESSION_EVENT, refreshSessionKey);
    window.addEventListener('storage', refreshSessionKey);
    return () => {
      window.removeEventListener(AUTH_SESSION_EVENT, refreshSessionKey);
      window.removeEventListener('storage', refreshSessionKey);
    };
  }, []);

  useEffect(() => {
    if (isPublicShell) {
      if (isLogin && getAuthToken()) router.replace('/');
      else if (isSetup && getAuthToken()) router.replace('/');
      else if (isCadastro && getAuthToken()) router.replace('/');
      setAllowBody(true);
      return;
    }

    if (!requireLogin) {
      setAllowBody(true);
      return;
    }

    if (!getAuthToken()) {
      router.replace('/login');
      return;
    }
    setAllowBody(true);
  }, [isLogin, isSetup, isCadastro, isPublicShell, pathname, router]);

  if (!allowBody) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 text-sm gap-4">
        <BrandLogo variant="full" className="opacity-90 scale-90" />
        A carregar…
      </div>
    );
  }

  if (isPublicShell) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  // key força remontar Sidebar + página ao trocar tenant (sem hard refresh manual)
  return (
    <div key={sessionKey} className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
