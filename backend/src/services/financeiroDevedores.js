const { prisma } = require("../lib/prisma");
const { EXPORT_MAX_ROWS } = require("./exportBatch");

/**
 * Monta saldos em aberto via groupBy de títulos (SSOT de cobrança).
 * debito/credito/saldo = valorOriginal / valorPago / em aberto dos títulos
 * (não confundir com conta corrente vendas−pagamentos).
 * Com take/skip, só busca dados dos clientes da página.
 * Sem take, limita a EXPORT_MAX_ROWS (exports).
 * @param {string} [busca] filtra por nome/documento do cliente
 */
async function listarClientesDevedores(
  tenantId,
  { take = null, skip = 0, busca = "" } = {},
) {
  const titulosAgg = await prisma.tituloReceber.groupBy({
    by: ["clienteId"],
    where: { tenantId },
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
  saldos.sort((a, b) => b.saldo - a.saldo);

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
  const pageSaldos =
    take == null ? saldos.slice(0, EXPORT_MAX_ROWS) : saldos.slice(skip, skip + take);
  const truncated = take == null && saldos.length > EXPORT_MAX_ROWS;

  const ids = pageSaldos.map((s) => s.clienteId);
  const clientes =
    ids.length === 0
      ? []
      : await prisma.cliente.findMany({
          where: { tenantId, id: { in: ids }, ativo: true },
        });
  const clienteMap = new Map(clientes.map((c) => [c.id, c]));

  const clientesDevedores = [];
  for (const s of pageSaldos) {
    const c = clienteMap.get(s.clienteId);
    if (!c) continue;
    clientesDevedores.push({
      cliente: c,
      debito: s.debito,
      credito: s.credito,
      saldo: s.saldo,
    });
  }

  return {
    clientesDevedores,
    clientesDevedoresCount: saldos.length,
    totalEmAberto,
    truncated,
  };
}

module.exports = { listarClientesDevedores };
