const { AppError } = require("../../shared/errors/appError");
const { recalcularTitulos } = require("../../services/recebiveis");
const { registrarEventoFinanceiro } = require("../../services/financeiroEventos");
const {
  findPagamentoById,
  deletePagamentoById,
} = require("../../infra/prisma/repositories/pagamentoRepository");

async function excluirPagamento(prisma, pagamentoId, tenantId) {
  if (tenantId == null) {
    throw new AppError("tenantId ausente", { code: "TENANT_REQUIRED", httpStatus: 500 });
  }
  return prisma.$transaction(async (tx) => {
    const pagamento = await findPagamentoById(tx, pagamentoId, tenantId);
    if (!pagamento) {
      throw new AppError("Pagamento não encontrado", {
        code: "PAGAMENTO_NAO_ENCONTRADO",
        httpStatus: 404,
      });
    }

    await deletePagamentoById(tx, pagamentoId, tenantId);
    await registrarEventoFinanceiro(tx, {
      tenantId,
      tipo: "PAGAMENTO_EXCLUIDO",
      entidade: "Pagamento",
      entidadeId: pagamento.id,
      pagamentoId: pagamento.id,
      clienteId: pagamento.clienteId,
      vendaId: pagamento.vendaId,
      valor: parseFloat(pagamento.valor),
    });

    await recalcularTitulos(tx, {
      clienteId: pagamento.clienteId,
      vendaId: pagamento.vendaId,
    });
  });
}

module.exports = { excluirPagamento };
