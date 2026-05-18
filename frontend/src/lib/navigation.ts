import type { ComponentType } from 'react';
import {
  HomeIcon,
  UserGroupIcon,
  CubeIcon,
  TruckIcon,
  UserIcon,
  ShoppingCartIcon,
  BanknotesIcon,
  UserPlusIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

type NavIcon = ComponentType<{ className?: string }>;

export type NavPermissionKey =
  | 'dashboard'
  | 'clientes'
  | 'produtos'
  | 'vendas'
  | 'cheques'
  | 'fretes'
  | 'motoristas'
  | 'vendedores'
  | 'rel_vendas'
  | 'rel_financeiro'
  | 'rel_comissoes'
  | 'rel_titulos'
  | 'auditoria';

type MainNavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  navKey: NavPermissionKey;
  advancedOnly?: boolean;
  adminOnly?: boolean;
};

type ReportNavItem = {
  href: string;
  label: string;
  navKey: NavPermissionKey;
  advancedOnly?: boolean;
};

/** Opções para o admin marcar por usuário (usuários = só admin, não listado). */
export const NAV_PERMISSION_OPTIONS: { key: NavPermissionKey; label: string; group: string }[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Principal' },
  { key: 'clientes', label: 'Clientes', group: 'Principal' },
  { key: 'produtos', label: 'Produtos', group: 'Principal' },
  { key: 'vendas', label: 'Vendas', group: 'Principal' },
  { key: 'cheques', label: 'Cheques', group: 'Principal' },
  { key: 'fretes', label: 'Fretes', group: 'Avançado' },
  { key: 'motoristas', label: 'Motoristas', group: 'Avançado' },
  { key: 'vendedores', label: 'Vendedores', group: 'Avançado' },
  { key: 'rel_vendas', label: 'Relatório de Vendas', group: 'Relatórios' },
  { key: 'rel_financeiro', label: 'Financeiro', group: 'Relatórios' },
  { key: 'rel_comissoes', label: 'Comissões', group: 'Relatórios' },
  { key: 'rel_titulos', label: 'Títulos a Receber', group: 'Relatórios' },
  { key: 'auditoria', label: 'Auditoria', group: 'Sistema' },
];

export const MAIN_NAV: MainNavItem[] = [
  { href: '/', label: 'Dashboard', icon: HomeIcon, navKey: 'dashboard' },
  { href: '/clientes', label: 'Clientes', icon: UserGroupIcon, navKey: 'clientes' },
  { href: '/produtos', label: 'Produtos', icon: CubeIcon, navKey: 'produtos' },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCartIcon, navKey: 'vendas' },
  { href: '/cheques', label: 'Cheques', icon: BanknotesIcon, navKey: 'cheques' },
  { href: '/fretes', label: 'Fretes', icon: TruckIcon, navKey: 'fretes', advancedOnly: true },
  { href: '/motoristas', label: 'Motoristas', icon: TruckIcon, navKey: 'motoristas', advancedOnly: true },
  { href: '/vendedores', label: 'Vendedores', icon: UserIcon, navKey: 'vendedores', advancedOnly: true },
  {
    href: '/auditoria',
    label: 'Auditoria',
    icon: ClipboardDocumentListIcon,
    navKey: 'auditoria',
  },
  {
    href: '/usuarios',
    label: 'Usuários',
    icon: UserPlusIcon,
    navKey: 'dashboard',
    adminOnly: true,
  },
];

export const REPORT_NAV: ReportNavItem[] = [
  { href: '/relatorios/vendas', label: 'Relatório de Vendas', navKey: 'rel_vendas' },
  { href: '/relatorios/financeiro', label: 'Financeiro', navKey: 'rel_financeiro' },
  { href: '/relatorios/comissoes', label: 'Comissões', navKey: 'rel_comissoes' },
  { href: '/relatorios/titulos', label: 'Títulos a Receber', navKey: 'rel_titulos', advancedOnly: true },
];

export function canAccessNavKey(
  navKey: NavPermissionKey,
  options: { isAdmin?: boolean; navPermissions?: string[] | null },
): boolean {
  if (options.isAdmin) return true;
  const perms = options.navPermissions;
  if (!perms || perms.length === 0) return true;
  return perms.includes(navKey);
}

export function filterMainNavForSidebar(
  items: MainNavItem[],
  hideAdvanced: boolean,
  options?: { isAdmin?: boolean; navPermissions?: string[] | null },
): MainNavItem[] {
  let out = items;
  if (hideAdvanced) out = out.filter((i) => !i.advancedOnly);
  if (options?.isAdmin !== true) out = out.filter((i) => !i.adminOnly);
  out = out.filter((i) =>
    canAccessNavKey(i.navKey, {
      isAdmin: options?.isAdmin,
      navPermissions: options?.navPermissions,
    }),
  );
  return out;
}

export function advancedMainNavItems(items: MainNavItem[]): MainNavItem[] {
  return items.filter((i) => i.advancedOnly);
}

export function filterReportsForSidebar(
  items: ReportNavItem[],
  hideAdvanced: boolean,
  options?: { isAdmin?: boolean; navPermissions?: string[] | null },
): ReportNavItem[] {
  let out = items;
  if (hideAdvanced) out = out.filter((i) => !i.advancedOnly);
  out = out.filter((i) =>
    canAccessNavKey(i.navKey, {
      isAdmin: options?.isAdmin,
      navPermissions: options?.navPermissions,
    }),
  );
  return out;
}

export function advancedReportItems(items: ReportNavItem[]): ReportNavItem[] {
  return items.filter((i) => i.advancedOnly);
}

/** Qualquer aba de relatório visível (para mostrar seção Relatórios). */
export function hasVisibleReports(
  hideAdvanced: boolean,
  options?: { isAdmin?: boolean; navPermissions?: string[] | null },
): boolean {
  return filterReportsForSidebar(REPORT_NAV, hideAdvanced, options).length > 0;
}
