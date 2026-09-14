const { prisma } = require("../lib/prisma");
const { EXPORT_MAX_ROWS } = require("./exportBatch");
const { tituloFiltroVendedor } = require("../utils/relatorioWhere");
const {
  montarFaixasAging,
  diasCivisDesdeVencimento,
  pctVencido,
} = require("../domain/financeiro/agingTitulos");
const { saldoAbertoNoTitulo } = require("../domain/financeiro/saldoCliente");

function parseOrdenar(raw) {
  const s = String(raw || "").trim();
  if (s === "atraso" || s === "titulos") return s;
  return "saldo";
}

/**
 * Monta saldos em aberto via groupBy de títulos (SSOT de cobrança).
 * debito/credito/saldo = valorOriginal / valorPago / em aberto dos títulos
 * (não confundir com conta corrente vendas−pagamentos).
 * Com take/skip, só devolve a página; totais e aging usam o conjunto filtrado.
 */
async function listarClientesDevedores(
  tenantId,
  { take = null, skip = 0, busca = "", vendedorId = "", ordenar = "saldo" } = {},
) {
  const tituloWhere = { tenantId };
  const vf = tituloFiltroVendedor(vendedorId);
  if (vf) tituloWhere.AND = [vf];

  const titulosAgg = await prisma.tituloReceber.groupBy({
    by: ["clienteId"],
    where: tituloWhere,
    _sum: { valorOriginal: true, valorPago: true },
  });

  let saldos = [];
  for (const a of titulosAgg) {
    const debito = parseFloat(String(a._sum.valorOriginal || 0));
    const credito = parseFloat(String(a._sum.valorPago || 0));
    const saldo = Math.max(0, debito - credito);
    if (saldo > 0.009) {
      saldos.push({ clienteId: a.clienteId, debito, credito, saldo });
    }
  }

  const term = String(busca || "").trim();
  if (term) {
    const matching = await prisma.cliente.findMany({
      where: {
        tenantId,
        ativo: true,
        OR: [
          { razaoSocial: { contains: term, mode: "insensitive" } },
          { nomeFantasia: { contains: term, mode: "insensitive" } },
          { cnpj: { contains: term } },
          { cpf: { contains: term } },
        ],
      },
      select: { id: true },
    });
    const idSet = new Set(matching.map((c) => c.id));
    saldos = saldos.filter((s) => idSet.has(s.clienteId));
  }

  const totalEmAberto = saldos.reduce((acc, s) => acc + s.saldo, 0);
  const totalOriginal = saldos.reduce((acc, s) => acc + s.debito, 0);
  const totalPago = saldos.reduce((acc, s) => acc + s.credito, 0);

  const idsFiltrados = saldos.map((s) => s.clienteId);
  const agingWhere = {
    ...tituloWhere,
    clienteId: { in: idsFiltrados.length ? idsFiltrados : [-1] },
  };
  const faixas = await montarFaixasAging(prisma, agingWhere);
  const totalVencido = faixas.vencidos;
  const totalAVencer = faixas.totalAVencer;

  const ordenarPor = parseOrdenar(ordenar);
  let statsPorCliente = new Map();
  if (ordenarPor !== "saldo" && idsFiltrados.length) {
    statsPorCliente = await carregarStatsTitulosAbertos(tenantId, tituloWhere, idsFiltrados);
  }

  if (ordenarPor === "atraso") {
    saldos.sort((a, b) => {
      const sa = statsPorCliente.get(a.clienteId) || { maiorAtrasoDias: 0 };
      const sb = statsPorCliente.get(b.clienteId) || { maiorAtrasoDias: 0 };
      if (sb.maiorAtrasoDias !== sa.maiorAtrasoDias) return sb.maiorAtrasoDias - sa.maiorAtrasoDias;
      return b.saldo - a.saldo;
    });
  } else if (ordenarPor === "titulos") {
    saldos.sort((a, b) => {
      const sa = statsPorCliente.get(a.clienteId) || { titulosAbertos: 0 };
      const sb = statsPorCliente.get(b.clienteId) || { titulosAbertos: 0 };
      if (sb.titulosAbertos !== sa.titulosAbertos) return sb.titulosAbertos - sa.titulosAbertos;
      return b.saldo - a.saldo;
    });
  } else {
    saldos.sort((a, b) => b.saldo - a.saldo);
  }

  const pageSaldos =
    take == null ? saldos.slice(0, EXPORT_MAX_ROWS) : saldos.slice(skip, skip + take);
  const truncated = take == null && saldos.length > EXPORT_MAX_ROWS;

  const ids = pageSaldos.map((s) => s.clienteId);
  const missingStats = ids.filter((id) => !statsPorCliente.has(id));
  if (missingStats.length) {
    const extra = await carregarStatsTitulosAbertos(tenantId, tituloWhere, missingStats);
    for (const [k, v] of extra) statsPorCliente.set(k, v);
  }

  const clientes =
    ids.length === 0
      ? []
      : await prisma.cliente.findMany({
          where: { tenantId, id: { in: ids }, ativo: true },
          include: { vendedor: { select: { id: true, nome: true } } },
        });
  const clienteMap = new Map(clientes.map((c) => [c.id, c]));

  const clientesDevedores = [];
  for (const s of pageSaldos) {
    const c = clienteMap.get(s.clienteId);
    if (!c) continue;
    const st = statsPorCliente.get(s.clienteId) || { titulosAbertos: 0, maiorAtrasoDias: 0 };
    clientesDevedores.push({
      cliente: c,
      debito: s.debito,
      credito: s.credito,
      saldo: s.saldo,
      participacao: totalEmAberto > 0.009 ? (s.saldo / totalEmAberto) * 100 : 0,
      titulosAbertos: st.titulosAbertos,
      maiorAtrasoDias: st.maiorAtrasoDias,
    });
  }

  return {
    clientesDevedores,
    clientesDevedoresCount: saldos.length,
    totalEmAberto,
    totalOriginal,
    totalPago,
    totalVencido,
    totalAVencer,
    pctVencido: pctVencido(totalVencido, totalEmAberto),
    faixas: {
      vencidos: faixas.vencidos,
      ate30: faixas.ate30,
      de31a60: faixas.de31a60,
      de61a90: faixas.de61a90,
      acima90: faixas.acima90,
    },
    truncated,
  };
}

async function carregarStatsTitulosAbertos(tenantId, tituloWhere, clienteIds) {
  const map = new Map();
  if (!clienteIds.length) return map;
  const titulos = await prisma.tituloReceber.findMany({
    where: {
      ...tituloWhere,
      clienteId: { in: clienteIds },
      status: { in: ["aberto", "parcial"] },
    },
    select: {
      clienteId: true,
      vencimento: true,
      valorOriginal: true,
      valorPago: true,
    },
  });
  for (const t of titulos) {
    if (saldoAbertoNoTitulo(t) <= 0.009) continue;
    const prev = map.get(t.clienteId) || { titulosAbertos: 0, maiorAtrasoDias: 0 };
    prev.titulosAbertos += 1;
    const atraso = Math.max(0, diasCivisDesdeVencimento(t.vencimento));
    if (atraso > prev.maiorAtrasoDias) prev.maiorAtrasoDias = atraso;
    map.set(t.clienteId, prev);
  }
  return map;
}

module.exports = { listarClientesDevedores };
