/**
 * Navegação compacta (MVP / time pequeno): oculta cadastros secundários e relatórios de análise
 * no menu principal, reunindo-os em "Avançado".
 *
 * Defina no .env.local: NEXT_PUBLIC_UI_HIDE_ADVANCED=true
 */
export const UI_HIDE_ADVANCED =
  process.env.NEXT_PUBLIC_UI_HIDE_ADVANCED === 'true';
