const { getDateRange } = require("./dateRangeQuery");

/**
 * Filtro de item por produto (id exato e/ou nome contendo texto).
 * Ex.: produtoBusca=dolomita puxa todas as variantes (M-325, M-200, …).
 * @returns {object|null}
 */
function buildItemProdutoFilter(query) {
  const produtoIdRaw = query?.produtoId;
  const produtoId = produtoIdRaw != null && String(produtoIdRaw).trim() !== ""
    ? parseInt(String(produtoIdRaw), 10)
    : NaN;
  const produtoBusca = String(query?.produtoBusca || "").trim();
  const filter = {};
  if (Number.isFinite(produtoId) && produtoId > 0) {
    filter.produtoId = produtoId;
  }
  if (produtoBusca) {
    filter.produto = { nome: { contains: produtoBusca, mode: "insensitive" } };
  }
  return Object.keys(filter).length > 0 ? filter : null;
}

function buildTitulosWhere(query, tenantId) {
  const {
    clienteId,
    status,
    dataVencInicio,
    dataVencFim,
    somenteEmAberto,
    vendaId,
  } = query;

  const where = { tenantId };
  if (clienteId) where.clienteId = parseInt(clienteId, 10);
  if (vendaId != null && String(vendaId).trim() !== "") {
    const vid = parseInt(String(vendaId).replace(/^#/, "").trim(), 10);
    if (!Number.isNaN(vid) && vid > 0) {
      // Aceita id interno OU número público da ordem (ex.: digitar 11 = Venda #11).
      where.OR = [{ vendaId: vid }, { venda: { numeroVenda: vid } }];
    }
  }
  if (status) where.status = status;
  if (somenteEmAberto === "true") where.status = { in: ["aberto", "parcial"] };
  if (dataVencInicio || dataVencFim) {
    where.vencimento = getDateRange(dataVencInicio, dataVencFim);
  }
  return where;
}

function buildVendasWhere(query, tenantId) {
  const {
    dataInicio,
    dataFim,
    clienteId,
    vendedorId,
    motoristaId,
    busca,
  } = query;
  const where = { tenantId };
  if (clienteId) where.clienteId = parseInt(clienteId, 10);
  if (vendedorId) where.vendedorId = parseInt(vendedorId, 10);
  if (motoristaId) where.motoristaId = parseInt(motoristaId, 10);
  if (dataInicio || dataFim) where.dataVenda = getDateRange(dataInicio, dataFim);
  const itemProduto = buildItemProdutoFilter(query);
  if (itemProduto) {
    where.itens = { some: itemProduto };
  }
  if (busca && String(busca).trim()) {
    const term = String(busca).trim();
    const ordemRaw = term.replace(/^#/, "").trim();
    const ordemNum = parseInt(ordemRaw, 10);
    const orConditions = [
      { cliente: { nomeFantasia: { contains: term, mode: "insensitive" } } },
      { cliente: { razaoSocial: { contains: term, mode: "insensitive" } } },
      { vendedor: { nome: { contains: term, mode: "insensitive" } } },
      { observacoes: { contains: term, mode: "insensitive" } },
    ];
    if (!Number.isNaN(ordemNum) && ordemNum > 0) {
      orConditions.push({ numeroVenda: ordemNum });
      if (String(ordemNum) === ordemRaw) {
        orConditions.push({ id: ordemNum });
      }
    }
    where.OR = orConditions;
  }
  return where;
}

module.exports = {
  buildTitulosWhere,
  buildVendasWhere,
  buildItemProdutoFilter,
};
