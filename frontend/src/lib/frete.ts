/** Frete de uma linha (espelha backend/src/domain/frete/calcularFrete.js). */

/** Peso de referência do saco “normal” (rateio do frete/saco). */
export const PESO_SACO_PADRAO_KG = 20;

function toNum(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Arredonda valor monetário (2 casas). */
export function roundMoney(n: unknown): number {
  return Math.round((toNum(n) + Number.EPSILON) * 100) / 100;
}

export function normalizarUnidade(unidadeRaw: unknown): string {
  const u = String(unidadeRaw || "")
    .trim()
    .toLowerCase();
  if (["saco", "sacos", "sc", "sac"].includes(u)) return "saco";
  if (["ton", "tonelada", "toneladas", "t"].includes(u)) return "ton";
  if (["kg", "quilo", "quilos"].includes(u)) return "kg";
  return u;
}

/**
 * Converte quantidade da venda para sacos (ordem de carregamento).
 * - saco: usa a quantidade como está
 * - ton: (qtd × 1000) / peso do saco (pesoKg do produto ou 20 kg)
 * - kg: qtd / peso do saco
 */
export function quantidadeEmSacos(params: {
  quantidade: number | string;
  unidade?: string | null;
  pesoKg?: number | string | null;
}): number {
  const qtd = toNum(params.quantidade);
  if (qtd <= 0) return 0;
  const unidade = normalizarUnidade(params.unidade);
  if (unidade === "saco") return qtd;
  const pesoSaco = (() => {
    const p = toNum(params.pesoKg);
    return p > 0 ? p : PESO_SACO_PADRAO_KG;
  })();
  if (unidade === "ton") return (qtd * 1000) / pesoSaco;
  if (unidade === "kg") return qtd / pesoSaco;
  return qtd;
}

/**
 * Unitário por peso (saco/unidade contada): prioriza frete/saco (× peso/20);
 * frete/ton só se saco = 0. Não usar em produtos já em ton/kg.
 */
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

/**
 * Frete de uma linha (espelha backend):
 * - ton / kg: qtd × tarifa/ton (pesoKg do cadastro não altera o frete)
 * - saco com pesoKg: rateio por peso
 * - saco sem pesoKg: qtd × tarifa/saco
 */
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
  const unidade = normalizarUnidade(params.unidade);
  const pesoKg = toNum(params.pesoKg);
  let bruto = 0;
  if (unidade === "ton") {
    bruto = qtd * tarifaTon;
  } else if (unidade === "kg") {
    bruto = qtd * (tarifaTon / 1000);
  } else if (pesoKg > 0) {
    bruto = qtd * freteUnitarioPorPeso(pesoKg, tarifaSaco, tarifaTon);
  } else if (unidade === "saco") {
    bruto = qtd * tarifaSaco;
  }
  return roundMoney(bruto);
}
