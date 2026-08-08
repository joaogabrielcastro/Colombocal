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
  Cog6ToothIcon,
  DocumentChartBarIcon,
} from '@heroicons/react/24/outline';

type NavIcon = ComponentType<{ className?: string }>;

export type NavPermissionKey =
  | 'dashboard'
  | 'clientes'
  | 'produtos'
  | 'vendas'
  | 'financeiro'
  | 'cheques'
  | 'fretes'
  | 'carregamento'
  | 'motoristas'
  | 'vendedores'
  | 'rel_vendas'
  | 'rel_financeiro'
  | 'rel_comissoes'
  | 'rel_titulos'
  | 'rel_fretes'
  | 'rel_carregamento'
  | 'rel_motoristas'
  | 'auditoria';

/** Migração: chaves legadas → canônicas. */
const LEGACY_NAV_KEY_ALIASES: Partial<Record<NavPermissionKey, NavPermissionKey>> = {
  cheques: 'financeiro',
  rel_titulos: 'rel_financeiro',
};

function normalizeNavKey(navKey: NavPermissionKey): NavPermissionKey {
  return LEGACY_NAV_KEY_ALIASES[navKey] ?? navKey;
}

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
  /** Só aparece quando o tenant tem frete/pátio. */
  requiresFrete?: boolean;
};

/** Opções para o admin marcar por usuário (usuários = só admin, não listado). */
export const NAV_PERMISSION_OPTIONS: { key: NavPermissionKey; label: string; group: string }[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Principal' },
  { key: 'clientes', label: 'Clientes', group: 'Principal' },
  { key: 'produtos', label: 'Produtos', group: 'Principal' },
  { key: 'vendas', label: 'Vendas', group: 'Principal' },
  { key: 'financeiro', label: 'Financeiro', group: 'Principal' },
  { key: 'fretes', label: 'Fretes', group: 'Avançado' },
  { key: 'carregamento', label: 'Carregamento', group: 'Avançado' },
  { key: 'motoristas', label: 'Motoristas', group: 'Avançado' },
  { key: 'vendedores', label: 'Vendedores', group: 'Avançado' },
  { key: 'rel_vendas', label: 'Relatório de Vendas', group: 'Relatórios' },
  { key: 'rel_financeiro', label: 'Contas a receber', group: 'Relatórios' },
  { key: 'rel_comissoes', label: 'Comissões', group: 'Relatórios' },
  { key: 'rel_fretes', label: 'Relatório de Fretes', group: 'Relatórios' },
  { key: 'rel_carregamento', label: 'Relatório de Carregamento', group: 'Relatórios' },
  { key: 'rel_motoristas', label: 'Relatório de Motoristas', group: 'Relatórios' },
  { key: 'auditoria', label: 'Auditoria', group: 'Sistema' },
];

/**
 * Menu clássico: Dashboard, Clientes, Produtos, Vendas, Financeiro + avançados.
 * Relatórios em REPORT_NAV. Contas a receber unifica saldos e títulos (sem duplicar).
 */
export const MAIN_NAV: MainNavItem[] = [
  { href: '/', label: 'Dashboard', icon: HomeIcon, navKey: 'dashboard' },
  { href: '/clientes', label: 'Clientes', icon: UserGroupIcon, navKey: 'clientes' },
  { href: '/produtos', label: 'Produtos', icon: CubeIcon, navKey: 'produtos' },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCartIcon, navKey: 'vendas' },
  { href: '/financeiro', label: 'Financeiro', icon: BanknotesIcon, navKey: 'financeiro' },
  { href: '/fretes', label: 'Fretes', icon: TruckIcon, navKey: 'fretes', advancedOnly: true },
  {
    href: '/carregamento',
    label: 'Carregamento',
    icon: ClipboardDocumentListIcon,
    navKey: 'carregamento',
    advancedOnly: true,
  },
  {
    href: '/motoristas',
    label: 'Motoristas',
    icon: TruckIcon,
    navKey: 'motoristas',
    advancedOnly: true,
  },
  {
    href: '/vendedores',
    label: 'Vendedores',
    icon: UserIcon,
    navKey: 'vendedores',
    advancedOnly: true,
  },
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
  { href: '/relatorios/financeiro', label: 'Contas a receber', navKey: 'rel_financeiro' },
  { href: '/relatorios/comissoes', label: 'Comissões', navKey: 'rel_comissoes' },
  {
    href: '/relatorios/fretes',
    label: 'Relatório de Fretes',
    navKey: 'rel_fretes',
    requiresFrete: true,
  },
  {
    href: '/relatorios/carregamento',
    label: 'Relatório de Carregamento',
    navKey: 'rel_carregamento',
    requiresFrete: true,
  },
  {
    href: '/relatorios/motoristas',
    label: 'Relatório de Motoristas',
    navKey: 'rel_motoristas',
    requiresFrete: true,
  },
];

export const CONFIG_NAV_HREF = '/configuracoes';

export function canAccessNavKey(
  navKey: NavPermissionKey,
  options: { isAdmin?: boolean; navPermissions?: string[] | null },
): boolean {
  if (options.isAdmin) return true;
  const perms = options.navPermissions;
  if (!perms || perms.length === 0) return true;
  const resolved = normalizeNavKey(navKey);
  return perms.some((p) => normalizeNavKey(p as NavPermissionKey) === resolved);
}

export function filterMainNavForSidebar(
  items: MainNavItem[],
  hideAdvanced: boolean,
  options?: { isAdmin?: boolean; navPermissions?: string[] | null; freteEnabled?: boolean },
): MainNavItem[] {
  let out = items;
  if (hideAdvanced) out = out.filter((i) => !i.advancedOnly);
  if (options?.isAdmin !== true) out = out.filter((i) => !i.adminOnly);
  if (options?.freteEnabled === false) {
    out = out.filter((i) => i.navKey !== 'fretes' && i.navKey !== 'carregamento');
  }
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
  options?: { isAdmin?: boolean; navPermissions?: string[] | null; freteEnabled?: boolean },
): ReportNavItem[] {
  let out = items;
  if (hideAdvanced) out = out.filter((i) => !i.advancedOnly);
  if (options?.freteEnabled === false) {
    out = out.filter((i) => !i.requiresFrete);
  }
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
  options?: { isAdmin?: boolean; navPermissions?: string[] | null; freteEnabled?: boolean },
): boolean {
  return filterReportsForSidebar(REPORT_NAV, hideAdvanced, options).length > 0;
}

export { Cog6ToothIcon, DocumentChartBarIcon };
