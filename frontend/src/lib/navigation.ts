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
  | 'motoristas'
  | 'vendedores'
  | 'rel_vendas'
  | 'rel_financeiro'
  | 'rel_comissoes'
  | 'rel_titulos'
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
  /** Itens de configuração (fora do fluxo diário). */
  configOnly?: boolean;
};

type ReportNavItem = {
  href: string;
  label: string;
  navKey: NavPermissionKey;
  advancedOnly?: boolean;
};

/** Opções para o admin marcar por usuário (usuários = só admin, não listado). */
export const NAV_PERMISSION_OPTIONS: { key: NavPermissionKey; label: string; group: string }[] = [
  { key: 'dashboard', label: 'Início', group: 'Principal' },
  { key: 'clientes', label: 'Clientes', group: 'Principal' },
  { key: 'vendas', label: 'Vendas', group: 'Principal' },
  { key: 'financeiro', label: 'Recebimentos', group: 'Principal' },
  { key: 'produtos', label: 'Produtos', group: 'Configurações' },
  { key: 'fretes', label: 'Fretes', group: 'Configurações' },
  { key: 'motoristas', label: 'Motoristas', group: 'Configurações' },
  { key: 'vendedores', label: 'Vendedores', group: 'Configurações' },
  { key: 'rel_vendas', label: 'Relatório de Vendas', group: 'Relatórios' },
  { key: 'rel_financeiro', label: 'Contas a receber', group: 'Relatórios' },
  { key: 'rel_comissoes', label: 'Comissões', group: 'Relatórios' },
  { key: 'auditoria', label: 'Auditoria', group: 'Configurações' },
];

/**
 * Menu operacional (padrão): Início, Clientes, Vendas, Recebimentos.
 * Relatórios ficam em REPORT_NAV. Cadastros auxiliares em CONFIG_NAV.
 */
export const MAIN_NAV: MainNavItem[] = [
  { href: '/', label: 'Início', icon: HomeIcon, navKey: 'dashboard' },
  { href: '/clientes', label: 'Clientes', icon: UserGroupIcon, navKey: 'clientes' },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCartIcon, navKey: 'vendas' },
  { href: '/financeiro', label: 'Recebimentos', icon: BanknotesIcon, navKey: 'financeiro' },
  {
    href: '/produtos',
    label: 'Produtos',
    icon: CubeIcon,
    navKey: 'produtos',
    advancedOnly: true,
    configOnly: true,
  },
  {
    href: '/fretes',
    label: 'Fretes',
    icon: TruckIcon,
    navKey: 'fretes',
    advancedOnly: true,
    configOnly: true,
  },
  {
    href: '/motoristas',
    label: 'Motoristas',
    icon: TruckIcon,
    navKey: 'motoristas',
    advancedOnly: true,
    configOnly: true,
  },
  {
    href: '/vendedores',
    label: 'Vendedores',
    icon: UserIcon,
    navKey: 'vendedores',
    advancedOnly: true,
    configOnly: true,
  },
  {
    href: '/auditoria',
    label: 'Auditoria',
    icon: ClipboardDocumentListIcon,
    navKey: 'auditoria',
    advancedOnly: true,
    configOnly: true,
  },
  {
    href: '/usuarios',
    label: 'Usuários',
    icon: UserPlusIcon,
    navKey: 'dashboard',
    adminOnly: true,
    configOnly: true,
  },
];

export const REPORT_NAV: ReportNavItem[] = [
  { href: '/relatorios/vendas', label: 'Relatório de Vendas', navKey: 'rel_vendas' },
  { href: '/relatorios/financeiro', label: 'Contas a receber', navKey: 'rel_financeiro' },
  { href: '/relatorios/comissoes', label: 'Comissões', navKey: 'rel_comissoes' },
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
  options?: { isAdmin?: boolean; navPermissions?: string[] | null },
): MainNavItem[] {
  let out = items;
  // Sempre esconder cadastros de configuração do menu principal
  out = out.filter((i) => !i.configOnly);
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

/** Itens de configuração (produtos, vendedores, etc.) filtrados por permissão. */
export function filterConfigNav(
  options?: { isAdmin?: boolean; navPermissions?: string[] | null; freteEnabled?: boolean },
): MainNavItem[] {
  return MAIN_NAV.filter((i) => i.configOnly)
    .filter((i) => options?.freteEnabled !== false || i.navKey !== 'fretes')
    .filter((i) => !i.adminOnly || options?.isAdmin === true)
    .filter((i) =>
      canAccessNavKey(i.navKey, {
        isAdmin: options?.isAdmin,
        navPermissions: options?.navPermissions,
      }),
    );
}

export function advancedMainNavItems(items: MainNavItem[]): MainNavItem[] {
  return items.filter((i) => i.advancedOnly && !i.configOnly);
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

export { Cog6ToothIcon, DocumentChartBarIcon };
