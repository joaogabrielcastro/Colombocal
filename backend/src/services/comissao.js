/**
 * Regras explícitas de comissão (sem NF).
 * - emissao: prioriza comissaoValor na venda; se zero, usa valorTotal ×
 *   comissaoPercentualAplicado (importações legadas costumam omitir comissaoValor).
 * - caixa: proporcional ao recebido na ordem, sobre o mesmo total de comissão da ordem.
 */

function parseMoney(v) {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Comissão total se a ordem estivesse 100% quitada: snapshot em comissaoValor ou
 * derivada do percentual aplicado na venda.
 */
function comissaoAlvoTotalOrdem(venda) {
  const stored = parseMoney(venda.comissaoValor);
  if (stored > 0) return Math.round(stored * 100) / 100;
  const total = parseMoney(venda.valorTotal);
  const pct = parseMoney(venda.comissaoPercentualAplicado);
  if (total <= 0 || pct <= 0) return 0;
  return Math.round(((total * pct) / 100) * 100) / 100;
}

function comissaoPorEmissao(venda) {
  return comissaoAlvoTotalOrdem(venda);
}

/** Pagamentos já devem ser filtrados por vendaId = venda.id */
function comissaoPorCaixa(venda, pagamentosDaVenda) {
  const totalVenda = parseMoney(venda.valorTotal);
  const comissaoTotal = comissaoAlvoTotalOrdem(venda);
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
  comissaoAlvoTotalOrdem,
  comissaoPorEmissao,
  comissaoPorCaixa,
  agregarComissoesPorVendedor,
};
