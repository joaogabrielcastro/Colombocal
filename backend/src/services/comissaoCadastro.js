function toPct(v) {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

/** Percentual padrão do cliente: fixa no cadastro ou % do representante. */
function percentualPadraoCliente(cliente, vendedor) {
  if (cliente?.comissaoFixaPercentual != null) {
    return toPct(cliente.comissaoFixaPercentual);
  }
  return toPct(vendedor?.comissaoPercentual);
}

/**
 * Resolve % de comissão para um produto:
 * 1) específica cliente+produto
 * 2) comissão fixa do cliente ou % do representante
 */
function resolverPercentualProduto(produtoId, cliente, vendedor, comissaoPorProdutoMap) {
  const especifica = comissaoPorProdutoMap?.get(produtoId);
  if (especifica != null) return toPct(especifica);
  return percentualPadraoCliente(cliente, vendedor);
}

/**
 * @param {Array<{ produtoId: number, quantidade: number, precoUnitario: number }>} itens
 */
function calcularComissaoParaVenda({ itens, cliente, vendedor, comissaoPorProdutoMap }) {
  let comissaoValorTotal = 0;
  let valorTotal = 0;

  const itensComComissao = itens.map((item) => {
    const subtotal = item.quantidade * item.precoUnitario;
    valorTotal += subtotal;
    const pct = resolverPercentualProduto(
      item.produtoId,
      cliente,
      vendedor,
      comissaoPorProdutoMap,
    );
    const comissaoValor = Math.round(((subtotal * pct) / 100) * 100) / 100;
    comissaoValorTotal += comissaoValor;
    return {
      ...item,
      subtotal,
      comissaoPercentualAplicado: pct,
      comissaoValor,
    };
  });

  comissaoValorTotal = Math.round(comissaoValorTotal * 100) / 100;
  const comissaoPercentualAplicado =
    valorTotal > 0
      ? Math.round(((comissaoValorTotal / valorTotal) * 100) * 100) / 100
      : 0;

  return {
    valorTotal,
    comissaoValor: comissaoValorTotal,
    comissaoPercentualAplicado,
    itensComComissao,
  };
}

async function loadComissaoMapPorCliente(tx, clienteId) {
  const rows = await tx.comissaoClienteProduto.findMany({
    where: { clienteId },
    select: { produtoId: true, comissaoPercentual: true },
  });
  return new Map(rows.map((r) => [r.produtoId, r.comissaoPercentual]));
}

module.exports = {
  toPct,
  percentualPadraoCliente,
  resolverPercentualProduto,
  calcularComissaoParaVenda,
  loadComissaoMapPorCliente,
};
