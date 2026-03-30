/**
 * Modo piloto / menu compacto: cadastros secundários (motorista, vendedor, frete) e relatórios
 * Comissões + Títulos ficam em "Avançado".
 *
 * Docker: NEXT_PUBLIC_UI_HIDE_ADVANCED=true (compose já define).
 * Local: crie frontend/.env.local com NEXT_PUBLIC_UI_HIDE_ADVANCED=false para menu cheio.
 */
export const UI_HIDE_ADVANCED =
  process.env.NEXT_PUBLIC_UI_HIDE_ADVANCED === 'true';
