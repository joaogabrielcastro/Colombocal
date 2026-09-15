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

/**
 * Produção sempre exige login no frontend.
 * Em desenvolvimento, NEXT_PUBLIC_REQUIRE_LOGIN=false permite UI sem JWT
 * (o backend continua sendo a autoridade: AUTH_DISABLED só vale fora de produção).
 */
export const REQUIRE_LOGIN =
  process.env.NODE_ENV === 'production' ||
  process.env.NEXT_PUBLIC_REQUIRE_LOGIN !== 'false';
