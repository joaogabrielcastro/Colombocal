const { saldoAbertoNoTitulo } = require("./saldoCliente");

/**
 * Aging de títulos — mesma regra de GET /api/relatorios/titulos.
 *
 * Faixas pelo VENCIMENTO (quando o dinheiro cai), não por dias de atraso:
 * - vencidos: vencimento < fim do dia de hoje (inclui vencimento hoje)
 * - ate30 / de31a60 / de61a90 / acima90: vence daqui a N dias
 *
 * Somas usam apenas status aberto/parcial: original − pago, nunca negativo.
 */

function fimDoDiaLocal(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function extrasFaixasAging(agora = new Date()) {
  const hoje = fimDoDiaLocal(agora);
  return {
    vencidos: { vencimento: { lt: hoje } },
    ate30: { vencimento: { gte: hoje, lte: addDays(hoje, 30) } },
    de31a60: { vencimento: { gt: addDays(hoje, 30), lte: addDays(hoje, 60) } },
    de61a90: { vencimento: { gt: addDays(hoje, 60), lte: addDays(hoje, 90) } },
    acima90: { vencimento: { gt: addDays(hoje, 90) } },
  };
}

async function somarAbertoNosTitulos(prisma, where, extraWhere = {}) {
  const agg = await prisma.tituloReceber.aggregate({
    where: {
      ...where,
      ...extraWhere,
      status: { in: ["aberto", "parcial"] },
    },
    _sum: { valorOriginal: true, valorPago: true },
  });
  const original = parseFloat(String(agg._sum.valorOriginal || 0));
  const pago = parseFloat(String(agg._sum.valorPago || 0));
  return Math.max(0, original - pago);
}

async function montarFaixasAging(prisma, where, agora = new Date()) {
  const extra = extrasFaixasAging(agora);
  const [vencidos, ate30, de31a60, de61a90, acima90] = await Promise.all([
    somarAbertoNosTitulos(prisma, where, extra.vencidos),
    somarAbertoNosTitulos(prisma, where, extra.ate30),
    somarAbertoNosTitulos(prisma, where, extra.de31a60),
    somarAbertoNosTitulos(prisma, where, extra.de61a90),
    somarAbertoNosTitulos(prisma, where, extra.acima90),
  ]);
  const totalAVencer = ate30 + de31a60 + de61a90 + acima90;
  return {
    vencidos,
    ate30,
    de31a60,
    de61a90,
    acima90,
    totalAVencer,
  };
}

function aplicarSituacaoNoWhere(where, situacao, agora = new Date()) {
  const s = String(situacao || "").trim();
  if (s !== "vencidos" && s !== "a_vencer") return where;
  const hoje = fimDoDiaLocal(agora);
  const extra =
    s === "vencidos"
      ? { vencimento: { lt: hoje } }
      : { vencimento: { gte: hoje } };
  where.AND = [...(Array.isArray(where.AND) ? where.AND : []), extra];
  return where;
}

/**
 * Dias civis: hoje − vencimento (meia-noite local).
 * >0 atraso, 0 vence hoje, <0 vence no futuro.
 */
function diasCivisDesdeVencimento(vencimento, agora = new Date()) {
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(vencimento);
  if (Number.isNaN(venc.getTime())) return 0;
  venc.setHours(0, 0, 0, 0);
  return Math.round((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
}

function camposVencimentoTitulo(titulo, agora = new Date()) {
  const aberto = saldoAbertoNoTitulo(titulo);
  const dias = diasCivisDesdeVencimento(titulo.vencimento, agora);
  const emAberto = aberto > 0.009;
  return {
    diasAtraso: emAberto ? Math.max(0, dias) : 0,
    diasAteVencer: emAberto ? Math.max(0, -dias) : 0,
    venceHoje: emAberto && dias === 0,
  };
}

function pctVencido(totalVencido, totalEmAberto) {
  if (!(totalEmAberto > 0.009)) return 0;
  return (totalVencido / totalEmAberto) * 100;
}

module.exports = {
  fimDoDiaLocal,
  addDays,
  extrasFaixasAging,
  somarAbertoNosTitulos,
  montarFaixasAging,
  aplicarSituacaoNoWhere,
  diasCivisDesdeVencimento,
  camposVencimentoTitulo,
  pctVencido,
};
