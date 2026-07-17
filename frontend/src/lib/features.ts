/**
 * Menu operacional enxuto: Início, Clientes, Vendas, Recebimentos (+ Relatórios).
 * Cadastros auxiliares (produtos, vendedores, motoristas, fretes, auditoria, usuários)
 * ficam em Configurações (`configOnly` em navigation.ts).
 *
 * `UI_HIDE_ADVANCED` ainda esconde relatórios/itens `advancedOnly` restantes.
 * Docker: NEXT_PUBLIC_UI_HIDE_ADVANCED=true
 * Local: frontend/.env.local com NEXT_PUBLIC_UI_HIDE_ADVANCED=false
 */
export const UI_HIDE_ADVANCED =
  process.env.NEXT_PUBLIC_UI_HIDE_ADVANCED === 'true';
