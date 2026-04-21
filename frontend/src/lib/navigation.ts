import type { ComponentType } from 'react';
import {
  HomeIcon,
  UserGroupIcon,
  CubeIcon,
  TruckIcon,
  UserIcon,
  ShoppingCartIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

type NavIcon = ComponentType<{ className?: string }>;

type MainNavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** No modo piloto (`UI_HIDE_ADVANCED`), aparece só no bloco "Avançado". */
  advancedOnly?: boolean;
};

type ReportNavItem = {
  href: string;
  label: string;
  advancedOnly?: boolean;
};

/** Itens principais da barra lateral (um único array; use `advancedOnly` para o modo piloto). */
export const MAIN_NAV: MainNavItem[] = [
  { href: '/', label: 'Dashboard', icon: HomeIcon },
  { href: '/clientes', label: 'Clientes', icon: UserGroupIcon },
  { href: '/produtos', label: 'Produtos', icon: CubeIcon },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCartIcon },
  { href: '/cheques', label: 'Cheques', icon: BanknotesIcon },
  { href: '/motoristas', label: 'Motoristas', icon: TruckIcon, advancedOnly: true },
  { href: '/vendedores', label: 'Vendedores', icon: UserIcon, advancedOnly: true },
];

export const REPORT_NAV: ReportNavItem[] = [
  { href: '/relatorios/vendas', label: 'Relatório de Vendas' },
  { href: '/relatorios/financeiro', label: 'Financeiro' },
  { href: '/relatorios/comissoes', label: 'Comissões' },
  { href: '/relatorios/titulos', label: 'Títulos a Receber', advancedOnly: true },
];

export function filterMainNavForSidebar(
  items: MainNavItem[],
  hideAdvanced: boolean,
): MainNavItem[] {
  if (!hideAdvanced) return items;
  return items.filter((i) => !i.advancedOnly);
}

export function advancedMainNavItems(items: MainNavItem[]): MainNavItem[] {
  return items.filter((i) => i.advancedOnly);
}

export function filterReportsForSidebar(
  items: ReportNavItem[],
  hideAdvanced: boolean,
): ReportNavItem[] {
  if (!hideAdvanced) return items;
  return items.filter((i) => !i.advancedOnly);
}

export function advancedReportItems(items: ReportNavItem[]): ReportNavItem[] {
  return items.filter((i) => i.advancedOnly);
}
