'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowDownTrayIcon,
  Bars3Icon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { BrandMark } from '@/components/brand/BrandMark';

type TopbarProps = {
  mobileNavOpen: boolean;
  onToggleMobileNav: () => void;
  onOpenSearch: () => void;
  canVender: boolean;
  canReceber: boolean;
};

function useIsMac() {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
  }, []);
  return mac;
}

export default function Topbar({
  mobileNavOpen,
  onToggleMobileNav,
  onOpenSearch,
  canVender,
  canReceber,
}: TopbarProps) {
  const pathname = usePathname();
  const isMac = useIsMac();
  // Evita botão duplicado quando a própria tela já oferece a ação.
  const showNovaVenda = canVender && !pathname.startsWith('/vendas');
  const showReceber = canReceber && !pathname.startsWith('/financeiro/novo');

  return (
    <header className="print:hidden sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 bg-white/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-white/75 sm:px-4 lg:px-6">
      <button
        type="button"
        data-testid="mobile-menu-button"
        className="btn-icon -ml-1 md:hidden"
        aria-label={mobileNavOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={mobileNavOpen}
        onClick={onToggleMobileNav}
      >
        {mobileNavOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
      </button>
      <Link href="/" className="md:hidden" aria-label="Colombocal — página inicial">
        <BrandMark className="h-8 w-8" />
      </Link>

      <button
        type="button"
        onClick={onOpenSearch}
        className="group ml-auto flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-sm text-gray-500 transition-colors hover:border-gray-300 hover:bg-white md:ml-0 md:w-full md:max-w-sm lg:max-w-md"
        aria-label="Buscar cliente, ordem ou tela"
        aria-keyshortcuts="Control+K Meta+K"
        data-testid="topbar-search"
      >
        <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-gray-600" aria-hidden="true" />
        <span className="hidden flex-1 truncate text-left md:block">Buscar cliente, ordem ou tela…</span>
        <span className="hidden items-center gap-0.5 md:flex" aria-hidden="true">
          <kbd className="kbd">{isMac ? '⌘' : 'Ctrl'}</kbd>
          <kbd className="kbd">K</kbd>
        </span>
      </button>

      <div className="flex items-center gap-2 md:ml-auto">
        {showReceber ? (
          <Link href="/financeiro/novo" className="btn-secondary btn-sm hidden lg:inline-flex">
            <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
            Receber
          </Link>
        ) : null}
        {showNovaVenda ? (
          <Link href="/vendas/nova" className="btn-primary btn-sm" aria-label="Nova venda">
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Nova venda</span>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
