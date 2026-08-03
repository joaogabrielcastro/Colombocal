/** Frete de uma linha (espelha backend/src/domain/frete/calcularFrete.js). */

/** Peso de referência do saco “normal” (rateio do frete/saco). */
export const PESO_SACO_PADRAO_KG = 20;

function toNum(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function normalizarUnidade(unidadeRaw: unknown): string {
  const u = String(unidadeRaw || "")
    .trim()
    .toLowerCase();
  if (["saco", "sacos", "sc"].includes(u)) return "saco";
  if (["ton", "tonelada", "toneladas", "t"].includes(u)) return "ton";
  if (["kg", "quilo", "quilos"].includes(u)) return "kg";
  return u;
}

/** Unitário por peso: prioriza frete/saco (× peso/20); frete/ton só se saco = 0. */
export function freteUnitarioPorPeso(
  pesoKg: number,
  fretePorSaco: number,
  fretePorTonelada: number,
): number {
  const tarifaTon = toNum(fretePorTonelada);
  const tarifaSaco = toNum(fretePorSaco);
  if (tarifaSaco > 0) return tarifaSaco * (pesoKg / PESO_SACO_PADRAO_KG);
  if (tarifaTon > 0) return pesoKg * (tarifaTon / 1000);
  return 0;
}

export function freteLinha(params: {
  unidade?: string | null;
  pesoKg?: number | string | null;
  quantidade: number | string;
  fretePorSaco: number;
  fretePorTonelada: number;
}): number {
  const qtd = toNum(params.quantidade);
  if (qtd <= 0) return 0;
  const tarifaSaco = toNum(params.fretePorSaco);
  const tarifaTon = toNum(params.fretePorTonelada);
  const pesoKg = toNum(params.pesoKg);
  if (pesoKg > 0) {
    return qtd * freteUnitarioPorPeso(pesoKg, tarifaSaco, tarifaTon);
  }
  const unidade = normalizarUnidade(params.unidade);
  if (unidade === "saco") return qtd * tarifaSaco;
  if (unidade === "ton") return qtd * tarifaTon;
  if (unidade === "kg") return qtd * (tarifaTon / 1000);
  return 0;
}
