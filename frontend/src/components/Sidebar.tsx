'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ChartBarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisHorizontalCircleIcon,
} from '@heroicons/react/24/outline';
import { UI_HIDE_ADVANCED } from '@/lib/features';
import {
  MAIN_NAV,
  REPORT_NAV,
  advancedMainNavItems,
  advancedReportItems,
  filterMainNavForSidebar,
  filterReportsForSidebar,
  hasVisibleReports,
} from '@/lib/navigation';
import { clearAuthToken, getAuthToken } from '@/lib/auth-token';
import api from '@/lib/api';

type MeUser = {
  role: string;
  navPermissions?: string[] | null;
};

export default function Sidebar() {
  const pathname = usePathname();
  const [me, setMe] = useState<MeUser | null>(null);

  useEffect(() => {
    if (!getAuthToken()) {
      setMe(null);
      return;
    }
    api
      .get<{ user: MeUser }>('/auth/me')
      .then((r) => setMe(r.user))
      .catch(() => setMe(null));
  }, []);

  const isAdmin = me?.role === 'admin';
  const navOpts = { isAdmin, navPermissions: me?.navPermissions ?? null };

  const mainVisible = filterMainNavForSidebar(MAIN_NAV, UI_HIDE_ADVANCED, navOpts);
  const advancedMain = advancedMainNavItems(MAIN_NAV).filter(
    (i) =>
      (!i.adminOnly || isAdmin) &&
      !mainVisible.some((v) => v.href === i.href) &&
      filterMainNavForSidebar([i], false, navOpts).length > 0,
  );
  const reportsVisible = filterReportsForSidebar(REPORT_NAV, UI_HIDE_ADVANCED, navOpts);
  const reportsAdvancedOnly = advancedReportItems(REPORT_NAV).filter(
    (i) =>
      !reportsVisible.some((v) => v.href === i.href) &&
      filterReportsForSidebar([i], false, navOpts).length > 0,
  );
  const showReportsSection = hasVisibleReports(UI_HIDE_ADVANCED, navOpts);

  const [relOpen, setRelOpen] = useState(pathname.startsWith('/relatorios'));
  const [advOpen, setAdvOpen] = useState(
    UI_HIDE_ADVANCED &&
      (advancedMain.some((i) => pathname.startsWith(i.href)) ||
        reportsAdvancedOnly.some((i) => pathname === i.href)),
  );

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-60 bg-gray-900 text-white flex flex-col flex-shrink-0 h-screen">
      <div className="px-5 py-5 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
            C
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Colombocal</p>
            <p className="text-gray-400 text-xs">Gestão Comercial</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {mainVisible.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors ${
              isActive(href)
                ? 'bg-blue-600 text-white font-medium'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {label}
          </Link>
        ))}

        {UI_HIDE_ADVANCED && advancedMain.length > 0 && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setAdvOpen(!advOpen)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors ${
                advancedMain.some((i) => pathname.startsWith(i.href)) ||
                reportsAdvancedOnly.some((i) => pathname === i.href)
                  ? 'bg-gray-800 text-white font-medium'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <EllipsisHorizontalCircleIcon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 text-left">Avançado</span>
              {advOpen ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </button>
            {advOpen && (
              <div className="ml-2 pl-3 border-l border-gray-700 mb-1 space-y-0.5">
                {advancedMain.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive(href)
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                  </Link>
                ))}
                {reportsAdvancedOnly.length > 0 && (
                  <>
                    <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-gray-500">
                      Relatórios — análise
                    </p>
                    {reportsAdvancedOnly.map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                          pathname === href
                            ? 'bg-blue-600 text-white font-medium'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        }`}
                      >
                        {label}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {showReportsSection && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setRelOpen(!relOpen)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors ${
                pathname.startsWith('/relatorios')
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <ChartBarIcon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 text-left">Relatórios</span>
              {relOpen ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </button>
            {relOpen && (
              <div className="ml-4 pl-3 border-l border-gray-700 mb-1">
                {reportsVisible.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors ${
                      pathname === href
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-gray-700 space-y-1">
        <button
          type="button"
          className="w-full text-left text-sm text-gray-400 hover:text-white py-2 px-2 rounded-lg hover:bg-gray-800"
          onClick={() => {
            clearAuthToken();
            window.location.href = '/login';
          }}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

