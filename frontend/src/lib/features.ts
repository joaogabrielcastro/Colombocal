/**
 * Menu clássico: Dashboard, Clientes, Produtos, Vendas, Financeiro (+ Relatórios).
 * Itens `advancedOnly` (fretes, motoristas, vendedores) vão para "Avançado" quando
 * `UI_HIDE_ADVANCED` está ativo.
 *
 * Docker: NEXT_PUBLIC_UI_HIDE_ADVANCED=true
 * Local: frontend/.env.local com NEXT_PUBLIC_UI_HIDE_ADVANCED=false
 */
export const UI_HIDE_ADVANCED =
  process.env.NEXT_PUBLIC_UI_HIDE_ADVANCED === 'true';
