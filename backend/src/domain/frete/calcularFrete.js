function toNum(v) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function pesoKgProduto(produto) {
  const n = toNum(produto?.pesoKg);
  return n > 0 ? n : 0;
}

function normalizarUnidade(unidadeRaw) {
  const u = String(unidadeRaw || "")
    .trim()
    .toLowerCase();
  if (["saco", "sacos", "sc"].includes(u)) return "saco";
  if (["ton", "tonelada", "toneladas", "t"].includes(u)) return "ton";
  if (["kg", "quilo", "quilos"].includes(u)) return "kg";
  return u;
}

/**
 * Frete de uma linha: se o produto tem pesoKg > 0, usa
 * qtd × pesoKg × (tarifaTon / 1000). Senão, cai na unidade (saco/ton/kg).
 */
function freteLinha({ produto, quantidade, fretePorSaco, fretePorTonelada }) {
  const qtd = toNum(quantidade);
  if (qtd <= 0) return 0;
  const tarifaSaco = toNum(fretePorSaco);
  const tarifaTon = toNum(fretePorTonelada);
  const pesoKg = pesoKgProduto(produto);
  if (pesoKg > 0) {
    return qtd * pesoKg * (tarifaTon / 1000);
  }
  const unidade = normalizarUnidade(produto?.unidade);
  if (unidade === "saco") return qtd * tarifaSaco;
  if (unidade === "ton") return qtd * tarifaTon;
  if (unidade === "kg") return qtd * (tarifaTon / 1000);
  return 0;
}

function calcularFreteAutomatico(itens, produtosPorId, fretePorSaco, fretePorTonelada) {
  return itens.reduce((acc, item) => {
    const produto =
      produtosPorId.get(item.produtoId) ||
      produtosPorId.get(Number(item.produtoId));
    return (
      acc +
      freteLinha({
        produto,
        quantidade: item.quantidade,
        fretePorSaco,
        fretePorTonelada,
      })
    );
  }, 0);
}

module.exports = {
  toNum,
  pesoKgProduto,
  normalizarUnidade,
  freteLinha,
  calcularFreteAutomatico,
};
