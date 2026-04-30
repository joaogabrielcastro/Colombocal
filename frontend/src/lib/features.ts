/**
 * Modo piloto / menu compacto: itens com `advancedOnly` em `lib/navigation.ts` somem da barra
 * principal e ficam em "Avançado" (motoristas, vendedores; relatório Títulos em análise).
 * Frete não tem item próprio: cadastro na venda; listagem histórica em /fretes (link na tela Vendas).
 *
 * Docker: NEXT_PUBLIC_UI_HIDE_ADVANCED=true (compose já define).
 * Local: crie frontend/.env.local com NEXT_PUBLIC_UI_HIDE_ADVANCED=false para menu cheio.
 */
export const UI_HIDE_ADVANCED =
  process.env.NEXT_PUBLIC_UI_HIDE_ADVANCED === 'true';
