const { prisma } = require("../lib/prisma");
const { EXPORT_MAX_ROWS } = require("./exportBatch");

/**
 * Monta saldos em aberto via groupBy de títulos (sem carregar todos os clientes).
 * Com take/skip, só busca dados dos clientes da página.
 * Sem take, limita a EXPORT_MAX_ROWS (exports).
 */
async function listarClientesDevedores(tenantId, { take = null, skip = 0 } = {}) {
  const titulosAgg = await prisma.tituloReceber.groupBy({
    by: ["clienteId"],
    where: { tenantId },
    _sum: { valorOriginal: true, valorPago: true },
  });

  const saldos = [];
  for (const a of titulosAgg) {
    const debito = parseFloat(String(a._sum.valorOriginal || 0));
    const credito = parseFloat(String(a._sum.valorPago || 0));
    const saldo = Math.max(0, debito - credito);
    if (saldo > 0.009) {
      saldos.push({ clienteId: a.clienteId, debito, credito, saldo });
    }
  }
  saldos.sort((a, b) => b.saldo - a.saldo);

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
