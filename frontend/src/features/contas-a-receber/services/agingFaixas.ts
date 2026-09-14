import type { FaixasAging } from "../types";

/** Rótulos das faixas já calculadas no backend — não classifica título. */
export const AGING_FAIXAS = [
  { key: "vencidos", label: "Vencido", tone: "danger" as const },
  { key: "ate30", label: "0–30 dias", tone: "neutral" as const },
  { key: "de31a60", label: "31–60 dias", tone: "neutral" as const },
  { key: "de61a90", label: "61–90 dias", tone: "neutral" as const },
  { key: "acima90", label: "90+ dias", tone: "neutral" as const },
] as const;

export type AgingFaixaKey = (typeof AGING_FAIXAS)[number]["key"];

export function totalFaixasAging(faixas: FaixasAging) {
  return (
    faixas.vencidos +
    faixas.ate30 +
    faixas.de31a60 +
    faixas.de61a90 +
    faixas.acima90
  );
}

export function barrasAging(faixas: FaixasAging) {
  const total = totalFaixasAging(faixas);
  return AGING_FAIXAS.map((meta) => {
    const valor = faixas[meta.key];
    const pct = total > 0.009 ? (valor / total) * 100 : 0;
    return { ...meta, valor, pct };
  });
}
