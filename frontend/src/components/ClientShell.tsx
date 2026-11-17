'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import BrandLogo from '@/components/BrandLogo';
import Topbar from '@/components/shell/Topbar';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { AUTH_SESSION_EVENT, getAuthTenantId, getAuthToken } from '@/lib/auth-token';
import { canAccessNavKey, canAccessPath } from '@/lib/navigation';
import { ApiError } from '@/lib/api';
import { fetchSession, getCachedSession, type SessionData } from '@/lib/session';
import { nextPathFromSearch } from '@/lib/safe-next-path';
import { REQUIRE_LOGIN } from '@/lib/features';
import { useTenantFeatures } from '@/hooks/useTenantFeatures';

/**
 * Por omissão exige JWT: rotas internas redirecionam para /login sem token.
 * Produção sempre exige login. Em dev: NEXT_PUBLIC_REQUIRE_LOGIN=false (backend continua protegendo a API).
 */
const requireLogin = REQUIRE_LOGIN;
const COLLAPSE_KEY = 'colombocal_sidebar_collapsed';

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/cadastro' ||
    pathname === '/esqueci-senha' ||
    pathname === '/redefinir-senha' ||
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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';
  const isSetupRoot = pathname === '/setup';
  const isCadastro = pathname === '/cadastro';
  const isPublicShell = isPublicPath(pathname);
  const features = useTenantFeatures();

  const [allowBody, setAllowBody] = useState(() => initialAllowBody(pathname));
  const [sessionKey, setSessionKey] = useState('boot');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navChecked, setNavChecked] = useState(!requireLogin || isPublicShell);
  const [navError, setNavError] = useState(false);
  const [navRetry, setNavRetry] = useState(0);
  const [session, setSession] = useState<SessionData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  /** Já houve uma verificação concluída nesta sessão? Evita esconder a tela a cada navegação. */
  const checkedOnce = useRef(false);

  useEffect(() => {
    const refreshSessionKey = () => {
      checkedOnce.current = false;
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
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* storage indisponível */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
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
    setMobileNavOpen(false);
    setPaletteOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  // Guarda de rota por permissão de menu. Usa a sessão em cache (sem rede) quando
  // disponível; a tela só fica oculta na primeira verificação da sessão.
  useEffect(() => {
    if (isPublicShell || !requireLogin || !getAuthToken()) return;

    let cancelled = false;
    const evaluate = (s: SessionData) => {
      const ok = canAccessPath(pathname, {
        isAdmin: s.user?.role === 'admin',
        navPermissions: s.user?.navPermissions ?? null,
      });
      if (!ok) {
        router.replace('/');
        return;
      }
      checkedOnce.current = true;
      setNavChecked(true);
    };

    const cached = getCachedSession();
    if (cached) {
      setSession(cached);
      setNavError(false);
      evaluate(cached);
      return;
    }

    if (!checkedOnce.current) setNavChecked(false);
    setNavError(false);
    fetchSession()
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        evaluate(s);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return;
        if (!checkedOnce.current) setNavError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, isPublicShell, router, sessionKey, navRetry]);

  // Atalhos globais: Ctrl/⌘+K abre a busca; "/" também, fora de campos de texto.
  useEffect(() => {
    if (isPublicShell) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isEditableTarget(e.target)) {
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPublicShell]);

  if (!allowBody || (!isPublicShell && !navChecked)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-sm text-gray-500">
        <BrandLogo variant="full" className="scale-90 opacity-90" />
        {navError ? (
          <>
            <p className="max-w-sm text-center">
              Não foi possível verificar sua sessão. Confira a conexão e tente novamente.
            </p>
            <button type="button" className="btn-primary" onClick={() => setNavRetry((n) => n + 1)}>
              Tentar novamente
            </button>
          </>
        ) : (
          <p role="status" className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-700" aria-hidden="true" />
            Carregando…
          </p>
        )}
      </div>
    );
  }

  if (isPublicShell) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  const isAdmin = session?.user?.role === 'admin';
  const navPermissions = session?.user?.navPermissions ?? null;
  const navOpts = {
    isAdmin,
    navPermissions,
    freteEnabled: features.freteEnabled,
    nfeEnabled: features.nfeEnabled,
    cteEnabled: features.cteEnabled,
    mdfeEnabled: features.mdfeEnabled,
    ciotEnabled: features.ciotEnabled,
  };

  return (
    <div key={sessionKey} className="flex h-screen flex-row print:block print:h-auto">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>
      <div className="h-full self-stretch print:hidden">
        <Sidebar
          mobileOpen={mobileNavOpen}
          onOpenMobile={() => setMobileNavOpen(true)}
          onCloseMobile={() => setMobileNavOpen(false)}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col print:max-w-none">
        <Topbar
          mobileNavOpen={mobileNavOpen}
          onToggleMobileNav={() => setMobileNavOpen((open) => !open)}
          onOpenSearch={() => setPaletteOpen(true)}
          canVender={canAccessNavKey('vendas', { isAdmin, navPermissions })}
          canReceber={canAccessNavKey('financeiro', { isAdmin, navPermissions })}
        />
        <main id="conteudo" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto focus:outline-none print:overflow-visible">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} nav={navOpts} />
    </div>
  );
}
