const { saldoContaCorrente, totalTitulosEmAberto } = require("../domain/financeiro/saldoCliente");

const TOLERANCIA_PADRAO = 0.01;

/**
 * Compara conta corrente (vendas − pagamentos) com títulos em aberto.
 * Diferença > tolerância = divergência (histórico/legado/frete vale etc.).
 * @param {{
 *   clienteId: number,
 *   totalDebitos: number,
 *   totalCreditos: number,
 *   titulos: Array<{ valorOriginal: unknown, valorPago: unknown }>,
 * }} row
 * @param {number} [tolerancia]
 */
function medirDivergenciaCliente(row, tolerancia = TOLERANCIA_PADRAO) {
  const contaCorrente = saldoContaCorrente(row.totalDebitos, row.totalCreditos);
  const titulosEmAberto = totalTitulosEmAberto(row.titulos || []);
  const diferenca = Math.round((titulosEmAberto - contaCorrente) * 100) / 100;
  const abs = Math.abs(diferenca);
  return {
    clienteId: row.clienteId,
    contaCorrente,
    titulosEmAberto,
    diferenca,
    divergente: abs > tolerancia,
  };
}

/**
 * Agrega por cliente e retorna quem diverge (SSOT = títulos).
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {number} tenantId
 * @param {{ take?: number, tolerancia?: number }} [opts]
 */
async function listarDivergenciasContaTitulos(
  prisma,
  tenantId,
  { take = 5, tolerancia = TOLERANCIA_PADRAO } = {},
) {
  const [vendasAgg, pagsAgg, titulosAgg] = await Promise.all([
    prisma.venda.groupBy({
      by: ["clienteId"],
      where: { tenantId },
      _sum: { valorTotal: true },
    }),
    prisma.pagamento.groupBy({
      by: ["clienteId"],
      where: { tenantId },
      _sum: { valor: true },
    }),
    prisma.tituloReceber.groupBy({
      by: ["clienteId"],
      where: { tenantId },
      _sum: { valorOriginal: true, valorPago: true },
    }),
  ]);

  const debitos = new Map(
    vendasAgg.map((a) => [
      a.clienteId,
      parseFloat(String(a._sum.valorTotal || 0)),
    ]),
  );
  const creditos = new Map(
    pagsAgg.map((a) => [a.clienteId, parseFloat(String(a._sum.valor || 0))]),
  );
  const titulosPorCliente = new Map(
    titulosAgg.map((a) => [
      a.clienteId,
      {
        valorOriginal: parseFloat(String(a._sum.valorOriginal || 0)),
        valorPago: parseFloat(String(a._sum.valorPago || 0)),
      },
    ]),
  );

  const ids = new Set([
    ...debitos.keys(),
    ...creditos.keys(),
    ...titulosPorCliente.keys(),
  ]);

  const divergentes = [];
  for (const clienteId of ids) {
    const t = titulosPorCliente.get(clienteId) || {
      valorOriginal: 0,
      valorPago: 0,
    };
    const medicao = medirDivergenciaCliente(
      {
        clienteId,
        totalDebitos: debitos.get(clienteId) || 0,
        totalCreditos: creditos.get(clienteId) || 0,
        // totalTitulosEmAberto espera lista; um título sintético agrega o mesmo.
        titulos: [t],
      },
      tolerancia,
    );
    if (medicao.divergente) divergentes.push(medicao);
  }

  divergentes.sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));

  const amostraIds = divergentes.slice(0, take).map((d) => d.clienteId);
  const clientes =
    amostraIds.length === 0
      ? []
      : await prisma.cliente.findMany({
          where: { tenantId, id: { in: amostraIds }, ativo: true },
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        });
  const nomeMap = new Map(
    clientes.map((c) => [
      c.id,
      (c.nomeFantasia && String(c.nomeFantasia).trim()) || c.razaoSocial,
    ]),
  );

  const amostra = divergentes.slice(0, take).map((d) => ({
    clienteId: d.clienteId,
    nome: nomeMap.get(d.clienteId) || `Cliente #${d.clienteId}`,
    contaCorrente: d.contaCorrente,
    titulosEmAberto: d.titulosEmAberto,
    diferenca: d.diferenca,
  }));

  return {
    clientesComDivergencia: divergentes.length,
    tolerancia,
    amostra,
    /** Soma |diferença| das divergências (diagnóstico). */
    somaAbsDiferenca: divergentes.reduce(
      (acc, d) => acc + Math.abs(d.diferenca),
      0,
    ),
  };
}

module.exports = {
  TOLERANCIA_PADRAO,
  medirDivergenciaCliente,
  listarDivergenciasContaTitulos,
};
