'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Bars3Icon,
  ChevronDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTenantFeatures } from '@/hooks/useTenantFeatures';
import {
  MAIN_NAV,
  REPORT_NAV,
  CONFIG_NAV_HREF,
  filterMainNavForSidebar,
  filterReportsForSidebar,
  canAccessNavKey,
} from '@/lib/navigation';
import { AUTH_SESSION_EVENT, clearAuthToken, getAuthToken } from '@/lib/auth-token';
import api from '@/lib/api';
import { BrandMark, BrandWordmark } from '@/components/brand/BrandMark';

type MeUser = {
  role: string;
  navPermissions?: string[] | null;
};

type MeTenant = {
  name: string;
  slug: string | null;
};

type TopNavProps = {
  mobileOpen?: boolean;
  onOpenMobile?: () => void;
  onCloseMobile?: () => void;
};

type NavLink = { href: string; label: string };

function useMe() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [tenant, setTenant] = useState<MeTenant | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadMe = () => {
      if (!getAuthToken()) {
        setMe(null);
        setTenant(null);
        return;
      }
      api
        .get<{ user: MeUser; tenant?: MeTenant }>('/auth/me')
        .then((r) => {
          if (cancelled) return;
          setMe(r.user);
          setTenant(r.tenant ?? null);
        })
        .catch(() => {
          if (cancelled) return;
          setMe(null);
          setTenant(null);
        });
    };
    loadMe();
    window.addEventListener(AUTH_SESSION_EVENT, loadMe);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_SESSION_EVENT, loadMe);
    };
  }, []);

  return { me, tenant };
}

function NavDropdown({
  label,
  active,
  open,
  onOpenChange,
  children,
}: {
  label: string;
  active: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  const place = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setBox({ top: Math.round(r.bottom + 6), left: Math.round(r.left) });
  };

  useEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    place();
    const onWin = () => place();
    const onScroll = () => onOpenChange(false);
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (open) onOpenChange(false);
          else {
            place();
            onOpenChange(true);
          }
        }}
        className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-md text-[15px] whitespace-nowrap transition-colors ${
          active || open
            ? 'bg-white/10 text-white'
            : 'text-gray-300 hover:text-white hover:bg-white/5'
        }`}
      >
        {label}
        <ChevronDownIcon
          className={`w-3.5 h-3.5 opacity-70 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && box ? (
        <div
          role="menu"
          style={{ position: 'fixed', top: box.top, left: box.left }}
          className="z-[9999] min-w-[13rem] rounded-lg bg-[#252b3b] py-1.5 shadow-xl ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default function TopNav({
  mobileOpen = false,
  onOpenMobile,
  onCloseMobile,
}: TopNavProps) {
  const pathname = usePathname();
  const { me, tenant } = useMe();
  const { freteEnabled } = useTenantFeatures();
  const [relOpen, setRelOpen] = useState(false);
  const [maisOpen, setMaisOpen] = useState(false);

  useEffect(() => {
    onCloseMobile?.();
    setRelOpen(false);
    setMaisOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const isAdmin = me?.role === 'admin';
  const navOpts = { isAdmin, navPermissions: me?.navPermissions ?? null };

  const allMain = filterMainNavForSidebar(MAIN_NAV, false, {
    ...navOpts,
    freteEnabled,
  }).filter((i) => i.href !== '/usuarios');

  const has = (href: string) => allMain.some((i) => i.href === href);

  /**
   * Ordem clara para o cliente:
   * Cadastro → Venda → Dinheiro → Pátio/frete → Relatórios → Sistema
   */
  const primary: NavLink[] = [
    { href: '/', label: 'Início' },
    { href: '/clientes', label: 'Clientes' },
    { href: '/produtos', label: 'Produtos' },
    { href: '/vendas', label: 'Vendas' },
    { href: '/financeiro', label: 'Financeiro' },
    ...(freteEnabled
      ? ([
          { href: '/fretes', label: 'Fretes' },
          { href: '/carregamento', label: 'Carregamento' },
          { href: '/motoristas', label: 'Motoristas' },
        ] as NavLink[])
      : []),
  ].filter((l) => has(l.href) || l.href === '/');

  const reports = filterReportsForSidebar(REPORT_NAV, false, navOpts);
  const showReports = reports.length > 0;

  const mais: NavLink[] = [
    { href: '/vendedores', label: 'Vendedores' },
    { href: '/auditoria', label: 'Auditoria' },
  ].filter((l) => {
    const item = MAIN_NAV.find((m) => m.href === l.href);
    return item && canAccessNavKey(item.navKey, navOpts) && has(l.href);
  });

  const showMais = mais.length > 0 || isAdmin;
  const showUsuarios = isAdmin;

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const linkClass = (active: boolean) =>
    `inline-flex items-center px-3.5 py-2 rounded-md text-[15px] whitespace-nowrap transition-colors ${
      active
        ? 'bg-white/10 text-white'
        : 'text-gray-300 hover:text-white hover:bg-white/5'
    }`;

  const dropLinkClass = (active: boolean) =>
    `block px-3.5 py-2 text-sm whitespace-nowrap transition-colors ${
      active
        ? 'bg-white/10 text-white'
        : 'text-gray-300 hover:bg-white/5 hover:text-white'
    }`;

  const logout = () => {
    clearAuthToken();
    window.location.href = '/login';
  };

  const mobileLinks: NavLink[] = [
    ...primary,
    ...reports.map((r) => ({ href: r.href, label: r.label })),
    ...mais,
    ...(isAdmin ? [{ href: CONFIG_NAV_HREF, label: 'Configurações' }] : []),
    ...(showUsuarios ? [{ href: '/usuarios', label: 'Usuários' }] : []),
  ];

  const desktopNav = (
    <>
      {primary.map(({ href, label }) => (
        <Link key={href} href={href} className={linkClass(isActive(href))}>
          {label}
        </Link>
      ))}

      {showReports ? (
        <NavDropdown
          label="Relatórios"
          active={pathname.startsWith('/relatorios')}
          open={relOpen}
          onOpenChange={(open) => {
            setRelOpen(open);
            if (open) setMaisOpen(false);
          }}
        >
          <p className="px-3.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Consultas
          </p>
          {reports.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              className={dropLinkClass(pathname === href)}
              onClick={() => setRelOpen(false)}
            >
              {label}
            </Link>
          ))}
        </NavDropdown>
      ) : null}

      {showMais ? (
        <NavDropdown
          label="Mais"
          active={
            mais.some((i) => isActive(i.href)) ||
            pathname.startsWith(CONFIG_NAV_HREF)
          }
          open={maisOpen}
          onOpenChange={(open) => {
            setMaisOpen(open);
            if (open) setRelOpen(false);
          }}
        >
          <p className="px-3.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Cadastros e sistema
          </p>
          {mais.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              className={dropLinkClass(isActive(href))}
              onClick={() => setMaisOpen(false)}
            >
              {label}
            </Link>
          ))}
          {isAdmin ? (
            <Link
              href={CONFIG_NAV_HREF}
              role="menuitem"
              className={dropLinkClass(pathname.startsWith(CONFIG_NAV_HREF))}
              onClick={() => setMaisOpen(false)}
            >
              Configurações
            </Link>
          ) : null}
        </NavDropdown>
      ) : null}
    </>
  );

  return (
    <header className="relative z-[100] flex-shrink-0 overflow-visible bg-[#1a1f2e] text-white">
      <div className="relative z-[100] grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 lg:px-6 h-14 overflow-visible">
        {/* Esquerda: logo */}
        <div className="flex items-center gap-2.5 min-w-0 justify-self-start">
          <button
            type="button"
            className="lg:hidden p-2 -ml-1 rounded-md text-gray-300 hover:text-white hover:bg-white/10"
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
            onClick={() => (mobileOpen ? onCloseMobile?.() : onOpenMobile?.())}
          >
            {mobileOpen ? (
              <XMarkIcon className="w-5 h-5" />
            ) : (
              <Bars3Icon className="w-5 h-5" />
            )}
          </button>

          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <BrandMark className="h-10 w-10" />
            <BrandWordmark light className="text-base hidden sm:block" />
          </Link>
        </div>

        {/* Centro: menu principal */}
        <nav className="hidden lg:flex items-center justify-center gap-2.5 flex-nowrap overflow-visible justify-self-center">
          {desktopNav}
        </nav>

        {/* Direita: org + ações */}
        <div className="hidden lg:flex items-center justify-end gap-0.5 flex-shrink-0 justify-self-end pl-2 border-l border-white/10">
          {tenant ? (
            <span
              className="hidden xl:inline text-xs text-gray-500 truncate max-w-[8rem] px-2"
              title={tenant.name}
            >
              {tenant.name}
            </span>
          ) : null}
          {showUsuarios ? (
            <Link
              href="/usuarios"
              className={linkClass(pathname.startsWith('/usuarios'))}
            >
              Usuários
            </Link>
          ) : null}
          <button
            type="button"
            className="inline-flex text-[15px] text-gray-300 hover:text-white px-3.5 py-2 rounded-md hover:bg-white/5"
            onClick={logout}
          >
            Sair
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="lg:hidden border-t border-white/10 bg-[#1a1f2e]">
          <nav className="max-h-[70vh] overflow-y-auto py-2 px-2">
            <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Menu
            </p>
            {mobileLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={onCloseMobile}
                className={`block px-3 py-2.5 rounded-md text-sm ${
                  isActive(href)
                    ? 'bg-white/10 text-white'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              className="w-full text-left px-3 py-2.5 rounded-md text-sm text-gray-400 hover:bg-white/5 hover:text-white mt-1"
              onClick={logout}
            >
              Sair
            </button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
