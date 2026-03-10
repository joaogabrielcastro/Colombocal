'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  HomeIcon,
  UserGroupIcon,
  CubeIcon,
  TruckIcon,
  UserIcon,
  ShoppingCartIcon,
  BanknotesIcon,
  ArrowsRightLeftIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { href: '/', label: 'Dashboard', icon: HomeIcon },
  { href: '/clientes', label: 'Clientes', icon: UserGroupIcon },
  { href: '/produtos', label: 'Produtos', icon: CubeIcon },
  { href: '/motoristas', label: 'Motoristas', icon: TruckIcon },
  { href: '/vendedores', label: 'Vendedores', icon: UserIcon },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCartIcon },
  { href: '/cheques', label: 'Cheques', icon: BanknotesIcon },
  { href: '/estoque', label: 'Estoque', icon: ArrowsRightLeftIcon },
];

const relatorioItems = [
  { href: '/relatorios/vendas', label: 'Relatório de Vendas' },
  { href: '/relatorios/comissoes', label: 'Comissões' },
  { href: '/relatorios/faturamento', label: 'Faturamento' },
  { href: '/relatorios/financeiro', label: 'Financeiro' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [relOpen, setRelOpen] = useState(pathname.startsWith('/relatorios'));

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-60 bg-gray-900 text-white flex flex-col flex-shrink-0 h-screen">
      {/* Logo */}
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navItems.map(({ href, label, icon: Icon }) => (
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

        {/* Relatórios submenu */}
        <div>
          <button
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
              {relatorioItems.map(({ href, label }) => (
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
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-700">
        <p className="text-gray-500 text-xs text-center">v1.0</p>
      </div>
    </aside>
  );
}
