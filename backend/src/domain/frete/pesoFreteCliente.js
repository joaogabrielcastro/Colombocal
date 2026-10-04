/**
 * Peso comercial de frete por cliente+produto (override do pesoKg do cadastro).
 * Não altera estoque nem ordem de carregamento — só o cálculo do frete.
 */

function toPesoPositivo(v) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @returns {Promise<Map<number, number>>} produtoId → pesoKgFrete
 */
async function loadPesoFreteMap(db, { tenantId, clienteId, produtoIds }) {
  const map = new Map();
  const ids = [...new Set((produtoIds || []).map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  if (tenantId == null || clienteId == null || !ids.length) return map;

  const rows = await db.precoClienteProduto.findMany({
    where: {
      tenantId,
      clienteId: Number(clienteId),
      produtoId: { in: ids },
      pesoKgFrete: { not: null },
    },
    select: { produtoId: true, pesoKgFrete: true },
  });
  for (const row of rows) {
    const peso = toPesoPositivo(row.pesoKgFrete);
    if (peso != null) map.set(row.produtoId, peso);
  }
  return map;
}

/** Cópia do produto com pesoKg trocado pelo override do cliente, se houver. */
function produtoComPesoFrete(produto, pesoFreteMap) {
  if (!produto) return produto;
  const override = pesoFreteMap?.get(produto.id);
  if (override == null) return produto;
  return { ...produto, pesoKg: override };
}

/** Aplica overrides num Map id→produto (mutando os valores do map). */
function aplicarPesoFreteNoMap(produtosPorId, pesoFreteMap) {
  if (!pesoFreteMap?.size) return produtosPorId;
  for (const [id, produto] of produtosPorId) {
    produtosPorId.set(id, produtoComPesoFrete(produto, pesoFreteMap));
  }
  return produtosPorId;
}

module.exports = {
  toPesoPositivo,
  loadPesoFreteMap,
  produtoComPesoFrete,
  aplicarPesoFreteNoMap,
};
