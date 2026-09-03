'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import TopNav from '@/components/TopNav';
import BrandLogo from '@/components/BrandLogo';
import { AUTH_SESSION_EVENT, getAuthTenantId, getAuthToken } from '@/lib/auth-token';
import { canAccessPath } from '@/lib/navigation';
import api, { ApiError } from '@/lib/api';
import { nextPathFromSearch } from '@/lib/safe-next-path';

/**
 * Por omissão exige JWT: rotas internas redirecionam para /login sem token.
 * Para desligar (ex.: dev com backend em AUTH_DISABLED): NEXT_PUBLIC_REQUIRE_LOGIN=false
 */
const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN !== 'false';

type MeUser = {
  role?: string;
  navPermissions?: string[] | null;
};

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/cadastro' ||
    pathname === '/setup' ||
    pathname.startsWith('/setup/')
  );
}

function initialAllowBody(pathname: string): boolean {
  if (isPublicPath(pathname) || !requireLogin) return true;
  return false;
}

function sessionKeyFromToken() {
  return `tenant-${getAuthTenantId() ?? 'none'}`;
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';
  const isSetupRoot = pathname === '/setup';
  const isCadastro = pathname === '/cadastro';
  const isPublicShell = isPublicPath(pathname);

  const [allowBody, setAllowBody] = useState(() => initialAllowBody(pathname));
  const [sessionKey, setSessionKey] = useState('boot');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navChecked, setNavChecked] = useState(!requireLogin || isPublicShell);
  const [navError, setNavError] = useState(false);
  const [navRetry, setNavRetry] = useState(0);

  useEffect(() => {
    const refreshSessionKey = () => {
      setSessionKey(`${sessionKeyFromToken()}-${Date.now()}`);
    };
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
      if (isLogin && getAuthToken()) {
        router.replace(nextPathFromSearch(window.location.search));
      } else if (isSetupRoot && getAuthToken()) {
        router.replace('/');
      } else if (isCadastro && getAuthToken()) {
        router.replace('/');
      }
      setAllowBody(true);
      setNavChecked(true);
      setNavError(false);
      return;
    }

    if (!requireLogin) {
      setAllowBody(true);
      setNavChecked(true);
      return;
    }

    if (!getAuthToken()) {
      setNavChecked(false);
      const next = encodeURIComponent(pathname || '/');
      router.replace(`/login?next=${next}`);
      return;
    }
    setAllowBody(true);
  }, [isLogin, isSetupRoot, isCadastro, isPublicShell, pathname, router]);

  useEffect(() => {
    if (isPublicShell || !requireLogin || !getAuthToken()) return;

    let cancelled = false;
    setNavChecked(false);
    setNavError(false);
    api
      .get<{ user: MeUser }>('/auth/me')
      .then((r) => {
        if (cancelled) return;
        const user = r.user;
        const isAdmin = user?.role === 'admin';
        const ok = canAccessPath(pathname, {
          isAdmin,
          navPermissions: user?.navPermissions ?? null,
        });
        if (!ok) {
          router.replace('/');
          return;
        }
        setNavChecked(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return;
        setNavError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, isPublicShell, router, sessionKey, navRetry]);

  if (!allowBody || (!isPublicShell && !navChecked)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 text-sm gap-4 px-4">
        <BrandLogo variant="full" className="opacity-90 scale-90" />
        {navError ? (
          <>
            <p className="text-center max-w-sm">
              Não foi possível verificar sua sessão. Confira a conexão e tente novamente.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setNavRetry((n) => n + 1)}
            >
              Tentar novamente
            </button>
          </>
        ) : (
          <p>A carregar…</p>
        )}
      </div>
    );
  }

  if (isPublicShell) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return (
    <div key={sessionKey} className="flex flex-col h-screen bg-gray-50">
      <TopNav
        mobileOpen={mobileNavOpen}
        onOpenMobile={() => setMobileNavOpen(true)}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <main className="flex-1 overflow-y-auto min-h-0">{children}</main>
    </div>
  );
}
