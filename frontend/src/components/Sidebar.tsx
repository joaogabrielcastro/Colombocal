'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  HomeIcon,
  UserGroupIcon,
  CubeIcon,
  ShoppingCartIcon,
  BanknotesIcon,
  TruckIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  UsersIcon,
  ArrowRightOnRectangleIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  UserIcon,
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

type SidebarProps = {
  mobileOpen?: boolean;
  onOpenMobile?: () => void;
  onCloseMobile?: () => void;
};

type NavLink = { href: string; label: string; icon?: React.ComponentType<{ className?: string }> };

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  '/': HomeIcon,
  '/clientes': UserGroupIcon,
  '/produtos': CubeIcon,
  '/vendas': ShoppingCartIcon,
  '/financeiro': BanknotesIcon,
  '/fretes': TruckIcon,
  '/carregamento': ClipboardDocumentListIcon,
  '/motoristas': UserIcon,
  '/vendedores': UserGroupIcon,
  '/auditoria': MagnifyingGlassIcon,
  '/usuarios': UsersIcon,
};

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

export default function Sidebar({
  mobileOpen = false,
  onOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const { me, tenant } = useMe();
  const { freteEnabled } = useTenantFeatures();
  const [reportsOpen, setReportsOpen] = useState(false);

  useEffect(() => {
    onCloseMobile?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Auto-expand reports section when on a report page
  useEffect(() => {
    if (pathname.startsWith('/relatorios')) setReportsOpen(true);
  }, [pathname]);

  const isAdmin = me?.role === 'admin';
  const navOpts = { isAdmin, navPermissions: me?.navPermissions ?? null };

  const allMain = filterMainNavForSidebar(MAIN_NAV, false, {
    ...navOpts,
    freteEnabled,
  }).filter((i) => i.href !== '/usuarios');

  const has = (href: string) => allMain.some((i) => i.href === href);

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

  const reports = filterReportsForSidebar(REPORT_NAV, false, {
    ...navOpts,
    freteEnabled,
  });

  const mais: NavLink[] = [
    { href: '/vendedores', label: 'Vendedores' },
    { href: '/auditoria', label: 'Auditoria' },
  ].filter((l) => {
    const item = MAIN_NAV.find((m) => m.href === l.href);
    return item && canAccessNavKey(item.navKey, navOpts) && has(l.href);
  });

  const showUsuarios = isAdmin;

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-white/10 text-white'
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`;

  const logout = () => {
    clearAuthToken();
    window.location.href = '/login';
  };

  const getIcon = (href: string) => iconMap[href] || DocumentTextIcon;

  const renderPanel = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 h-16 flex-shrink-0 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark className="h-9 w-9" />
          <BrandWordmark light className="text-base" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {primary.map(({ href, label }) => {
          const Icon = getIcon(href);
          return (
            <Link key={href} href={href} className={linkClass(isActive(href))}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
            </Link>
          );
        })}

        {reports.length > 0 && (
          <div className="pt-3">
            <button
              type="button"
              onClick={() => setReportsOpen(!reportsOpen)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors ${
                pathname.startsWith('/relatorios')
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ChartBarIcon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 text-left">Relatórios</span>
              <svg
                className={`w-4 h-4 transition-transform ${reportsOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {reportsOpen && (
              <div className="ml-4 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                {reports.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                      pathname === href
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {mais.length > 0 && (
          <div className="pt-3">
            <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
              Sistema
            </p>
            {mais.map(({ href, label }) => {
              const Icon = getIcon(href);
              return (
                <Link key={href} href={href} className={linkClass(isActive(href))}>
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        )}

        {isAdmin && (
          <div className="pt-3">
            <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
              Administração
            </p>
            <Link href={CONFIG_NAV_HREF} className={linkClass(pathname.startsWith(CONFIG_NAV_HREF))}>
              <Cog6ToothIcon className="w-5 h-5 flex-shrink-0" />
              Configurações
            </Link>
            {showUsuarios && (
              <Link href="/usuarios" className={linkClass(pathname.startsWith('/usuarios'))}>
                <UsersIcon className="w-5 h-5 flex-shrink-0" />
                Usuários
              </Link>
            )}
          </div>
        )}
      </nav>

      <div className="flex-shrink-0 border-t border-white/10 px-3 py-3">
        {tenant && (
          <p className="text-xs text-gray-500 truncate px-3 mb-2" title={tenant.name}>
            {tenant.name}
          </p>
        )}
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 w-full transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <aside className="flex flex-col w-60 flex-shrink-0 bg-[#1a1f2e] text-white h-full overflow-hidden">
      {renderPanel()}
    </aside>
  );
}
