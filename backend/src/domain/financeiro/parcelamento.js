const { addDaysCalendar } = require("../../utils/validation");

/**
 * Divide valor em N parcelas iguais (centavos).
 * A última parcela absorve a diferença de arredondamento.
 * Ex.: R$ 100 / 3 → [33.33, 33.33, 33.34]
 */
function dividirValorIgual(valorTotal, nParcelas) {
  const n = Math.max(1, Math.floor(Number(nParcelas) || 1));
  const totalCentavos = Math.round(Number(valorTotal) * 100);
  if (!Number.isFinite(totalCentavos) || totalCentavos < 0) {
    throw new Error("valorTotal inválido para parcelamento");
  }
  const base = Math.floor(totalCentavos / n);
  const resto = totalCentavos - base * n;
  const valores = [];
  for (let i = 0; i < n; i++) {
    const centavos = i === n - 1 ? base + resto : base;
    valores.push(centavos / 100);
  }
  return valores;
}

/** Vencimentos em dias corridos a partir da data base. */
function calcularVencimentos(dataBase, diasParcelas) {
  const dias = Array.isArray(diasParcelas) && diasParcelas.length > 0
    ? diasParcelas.map((d) => Math.max(0, Math.floor(Number(d) || 0)))
    : [30];
  return dias.map((d) => addDaysCalendar(dataBase, d));
}

/**
 * Monta parcelas para criar TituloReceber.
 * numero: VENDA-{n}-{p}/{q} (q=1 → VENDA-{n} para compatibilidade visual simples)
 */
function montarParcelas({
  valorTotal,
  dias,
  dataBase,
  numeroVenda,
}) {
  const diasNorm = Array.isArray(dias) && dias.length > 0
    ? dias.map((d) => Math.max(0, Math.floor(Number(d) || 0)))
    : [30];
  const valores = dividirValorIgual(valorTotal, diasNorm.length);
  const vencimentos = calcularVencimentos(dataBase, diasNorm);
  const total = valores.length;
  return valores.map((valor, i) => {
    const parcelaNumero = i + 1;
    const numero =
      total === 1
        ? `VENDA-${numeroVenda}`
        : `VENDA-${numeroVenda}-${parcelaNumero}/${total}`;
    return {
      numero,
      valor,
      vencimento: vencimentos[i],
      parcelaNumero,
      parcelaTotal: total,
      dias: diasNorm[i],
    };
  });
}

/** Condições padrão sugeridas por tenant. */
const CONDICOES_PADRAO = [
  { nome: "À vista", diasParcelas: [0], descricao: "Pagamento na data da venda" },
  { nome: "15", diasParcelas: [15] },
  { nome: "30", diasParcelas: [30] },
  { nome: "45", diasParcelas: [45] },
  { nome: "60", diasParcelas: [60] },
  { nome: "90", diasParcelas: [90] },
  { nome: "15/30", diasParcelas: [15, 30] },
  { nome: "30/60", diasParcelas: [30, 60] },
  { nome: "30/60/90", diasParcelas: [30, 60, 90] },
  { nome: "15/30/45", diasParcelas: [15, 30, 45] },
  { nome: "15/30/45/60/90", diasParcelas: [15, 30, 45, 60, 90] },
];

function normalizarDiasParcelas(input) {
  if (Array.isArray(input) && input.length > 0) {
    return input.map((d) => Math.max(0, Math.floor(Number(d) || 0)));
  }
  if (typeof input === "string" && input.trim()) {
    const raw = input.trim();
    if (/^à?\s*vista$/i.test(raw) || /^a\s*vista$/i.test(raw)) {
      return [0];
    }
    const parts = raw
      .split(/[/\s,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return [30];
    if (parts.length === 1 && /vista/i.test(parts[0])) return [0];
    return parts.map((p) => Math.max(0, Math.floor(Number(p) || 0)));
  }
  return [30];
}

module.exports = {
  dividirValorIgual,
  calcularVencimentos,
  montarParcelas,
  CONDICOES_PADRAO,
  normalizarDiasParcelas,
};
