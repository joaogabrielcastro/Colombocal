/**
 * Regras explícitas de comissão (sem NF).
 * - emissao: usa comissaoValor gravado na venda (histórico na data da venda).
 * - caixa: proporcional ao recebido na ordem (pagamentos vinculados à venda).
 */

function parseMoney(v) {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function comissaoPorEmissao(venda) {
  return parseMoney(venda.comissaoValor);
}

/** Pagamentos já devem ser filtrados por vendaId = venda.id */
function comissaoPorCaixa(venda, pagamentosDaVenda) {
  const totalVenda = parseMoney(venda.valorTotal);
  const comissaoTotal = parseMoney(venda.comissaoValor);
  if (totalVenda <= 0) return 0;
  const pago = pagamentosDaVenda.reduce((acc, p) => acc + parseMoney(p.valor), 0);
  const ratio = Math.min(1, Math.max(0, pago / totalVenda));
  return Math.round(comissaoTotal * ratio * 100) / 100;
}

function agregarComissoesPorVendedor(vendas, pagamentosPorVendaId, modo) {
  const byVid = new Map();
  for (const v of vendas) {
    const vid = v.vendedorId;
    if (!byVid.has(vid)) {
      byVid.set(vid, { totalVendas: 0, comissao: 0, count: 0 });
    }
    const agg = byVid.get(vid);
    agg.totalVendas += parseMoney(v.valorTotal);
    agg.count += 1;
    const pags = pagamentosPorVendaId.get(v.id) || [];
    const c =
      modo === "caixa"
        ? comissaoPorCaixa(v, pags)
        : comissaoPorEmissao(v);
    agg.comissao += c;
  }
  return byVid;
}

module.exports = {
  parseMoney,
  comissaoPorEmissao,
  comissaoPorCaixa,
  agregarComissoesPorVendedor,
};
