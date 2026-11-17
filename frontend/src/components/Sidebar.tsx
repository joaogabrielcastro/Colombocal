'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTenantFeatures } from '@/hooks/useTenantFeatures';
import { buildNavGroups, isNavHrefActive, type NavGroup } from '@/lib/navigation';
import { clearAuthToken } from '@/lib/auth-token';
import { useSession } from '@/lib/session';
import { BrandMark, BrandWordmark } from '@/components/brand/BrandMark';

type SidebarProps = {
  mobileOpen?: boolean;
  onOpenMobile?: () => void;
  onCloseMobile?: () => void;
  /** Desktop: barra recolhida (apenas ícones). */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

function initials(name?: string | null, email?: string | null) {
  const base = (name || email || '').trim();
  if (!base) return '?';
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

const itemBase =
  'group relative flex items-center gap-3 rounded-lg px-2.5 py-[7px] text-[13.5px] font-medium transition-colors';
const itemIdle = 'text-white/65 hover:bg-white/[0.06] hover:text-white';
const itemActive = 'bg-white/[0.10] text-white';

function ActiveBar() {
  return (
    <span
      aria-hidden="true"
      className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gold"
    />
  );
}

export default function Sidebar({
  mobileOpen = false,
  onCloseMobile,
  collapsed = false,
  onToggleCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, tenant, isAdmin, navPermissions } = useSession();
  const { freteEnabled, nfeEnabled, cteEnabled, mdfeEnabled, ciotEnabled } =
    useTenantFeatures();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const mobileAsideRef = useRef<HTMLElement>(null);

  // React 18 ainda não serializa o atributo HTML `inert` de forma confiável.
  // Aplicá-lo diretamente impede que links do drawer fechado recebam foco.
  useEffect(() => {
    const drawer = mobileAsideRef.current;
    if (!drawer) return;
    if (mobileOpen) drawer.removeAttribute('inert');
    else drawer.setAttribute('inert', '');
  }, [mobileOpen]);

  useEffect(() => {
    onCloseMobile?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Abre automaticamente o grupo recolhível da seção atual.
  useEffect(() => {
    if (pathname.startsWith('/relatorios')) setOpenGroups((g) => ({ ...g, relatorios: true }));
    if (pathname.startsWith('/fiscal')) setOpenGroups((g) => ({ ...g, fiscal: true }));
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  const groups = useMemo(
    () =>
      buildNavGroups({
        isAdmin,
        navPermissions,
        freteEnabled,
        nfeEnabled,
        cteEnabled,
        mdfeEnabled,
        ciotEnabled,
      }),
    [isAdmin, navPermissions, freteEnabled, nfeEnabled, cteEnabled, mdfeEnabled, ciotEnabled],
  );

  const logout = () => {
    clearAuthToken();
    window.location.href = '/login';
  };
  const closeMobile = () => onCloseMobile?.();

  const renderGroup = (group: NavGroup, rail: boolean, idx: number) => {
    if (group.collapsible) {
      const GroupIcon = group.icon!;
      const sectionActive = group.items.some((i) => isNavHrefActive(i.href, pathname));
      if (rail) {
        // Barra recolhida: o grupo vira um atalho para o primeiro item.
        const first = group.items[0];
        return (
          <Link
            key={group.id}
            href={first.href}
            title={group.label}
            aria-label={group.label}
            className={`${itemBase} justify-center ${sectionActive ? itemActive : itemIdle}`}
          >
            {sectionActive ? <ActiveBar /> : null}
            <GroupIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          </Link>
        );
      }
      const open = !!openGroups[group.id];
      const panelId = `sidebar-${group.id}-navigation`;
      return (
        <div key={group.id} className={idx > 0 ? 'pt-1' : ''}>
          <button
            type="button"
            onClick={() => setOpenGroups((g) => ({ ...g, [group.id]: !open }))}
            aria-expanded={open}
            aria-controls={panelId}
            className={`${itemBase} w-full ${sectionActive && !open ? itemActive : itemIdle}`}
          >
            <GroupIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">{group.label}</span>
            <ChevronDownIcon
              className={`h-4 w-4 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          {open ? (
            <div id={panelId} className="ml-[1.35rem] mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
              {group.items.map(({ href, label }) => {
                const active = isNavHrefActive(href, pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={closeMobile}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                      active ? 'bg-white/[0.10] font-medium text-white' : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div key={group.id} className="space-y-0.5">
        {rail ? (
          idx > 0 ? <div className="mx-2 my-2 border-t border-white/10" aria-hidden="true" /> : null
        ) : (
          <p
            className={`px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/35 ${idx > 0 ? 'pt-3.5' : ''}`}
          >
            {group.label}
          </p>
        )}
        {group.items.map(({ href, label, icon: Icon }) => {
          const active = isNavHrefActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              onClick={closeMobile}
              title={rail ? label : undefined}
              aria-label={rail ? label : undefined}
              aria-current={active ? 'page' : undefined}
              className={`${itemBase} ${rail ? 'justify-center' : ''} ${active ? itemActive : itemIdle}`}
            >
              {active ? <ActiveBar /> : null}
              <Icon
                className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`}
                aria-hidden="true"
              />
              {rail ? null : label}
            </Link>
          );
        })}
      </div>
    );
  };

  const renderPanel = (rail: boolean, isMobile: boolean) => (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-14 shrink-0 items-center gap-2.5 border-b border-white/[0.08] ${rail ? 'justify-center px-2' : 'px-4'}`}
      >
        <Link href="/" className="flex min-w-0 items-center gap-2.5" onClick={closeMobile} aria-label="Colombocal — página inicial">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
            <BrandMark className="h-7 w-7" />
          </span>
          {rail ? null : <BrandWordmark light className="text-[15px]" />}
        </Link>
        {isMobile ? (
          <button
            type="button"
            className="ml-auto rounded-lg p-2 text-white/60 hover:bg-white/[0.06] hover:text-white"
            aria-label="Fechar menu"
            data-testid="mobile-nav-close"
            onClick={closeMobile}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav
        className={`flex-1 overflow-y-auto py-3 ${rail ? 'px-2' : 'px-3'} [scrollbar-color:rgb(255_255_255/0.15)_transparent]`}
        aria-label="Navegação principal"
      >
        <div className="space-y-1">{groups.map((g, i) => renderGroup(g, rail, i))}</div>
      </nav>

      <div className={`shrink-0 border-t border-white/[0.08] ${rail ? 'px-2 py-2.5' : 'px-3 py-2.5'}`}>
        {rail ? null : (
          <div className="mb-1 flex items-center gap-2.5 rounded-lg px-2 py-1">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white"
              aria-hidden="true"
            >
              {initials(user?.name, user?.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white" title={user?.email ?? undefined}>
                {user?.name || user?.email || 'Usuário'}
              </p>
              {tenant ? (
                <p
                  className="truncate text-[11.5px] text-white/50"
                  title={tenant.name}
                  data-testid="sidebar-tenant-name"
                >
                  {tenant.name}
                  {isAdmin ? ' · Admin' : ''}
                </p>
              ) : null}
            </div>
          </div>
        )}
        <div className={`flex ${rail ? 'flex-col items-center gap-1' : 'items-center gap-1'}`}>
          <button
            type="button"
            onClick={() => {
              closeMobile();
              logout();
            }}
            title="Sair"
            className={`${itemBase} ${itemIdle} ${rail ? 'justify-center' : 'flex-1'}`}
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0 text-white/50" aria-hidden="true" />
            {rail ? <span className="sr-only">Sair</span> : 'Sair'}
          </button>
          {!isMobile && onToggleCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="rounded-lg p-2 text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label={rail ? 'Expandir menu' : 'Recolher menu'}
              title={rail ? 'Expandir menu' : 'Recolher menu'}
            >
              {rail ? (
                <ChevronDoubleRightIcon className="h-4 w-4" />
              ) : (
                <ChevronDoubleLeftIcon className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden h-full shrink-0 flex-col overflow-hidden bg-brand-950 text-white transition-[width] duration-200 md:flex ${
          collapsed ? 'w-16' : 'w-[var(--sidebar-w)]'
        }`}
        data-testid="sidebar-desktop"
        data-collapsed={collapsed ? 'true' : 'false'}
      >
        {renderPanel(collapsed, false)}
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          data-testid="mobile-nav-overlay"
          className="fixed inset-0 z-40 bg-gray-950/50 backdrop-blur-[1px] md:hidden"
          aria-label="Fechar menu"
          onClick={() => onCloseMobile?.()}
        />
      ) : null}

      <aside
        ref={mobileAsideRef}
        data-testid="sidebar-mobile"
        aria-hidden={!mobileOpen}
        aria-label="Menu principal"
        aria-modal={mobileOpen ? true : undefined}
        role={mobileOpen ? 'dialog' : undefined}
        className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] transform flex-col overflow-hidden bg-brand-950 text-white shadow-xl transition-transform duration-200 md:hidden ${
          mobileOpen ? 'translate-x-0' : 'pointer-events-none -translate-x-full'
        }`}
      >
        {renderPanel(false, true)}
      </aside>
    </>
  );
}
