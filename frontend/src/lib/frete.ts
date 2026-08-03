/** Frete de uma linha (espelha backend/src/domain/frete/calcularFrete.js). */

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
    return qtd * pesoKg * (tarifaTon / 1000);
  }
  const unidade = normalizarUnidade(params.unidade);
  if (unidade === "saco") return qtd * tarifaSaco;
  if (unidade === "ton") return qtd * tarifaTon;
  if (unidade === "kg") return qtd * (tarifaTon / 1000);
  return 0;
}
