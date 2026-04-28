const { AppError } = require("../../shared/errors/appError");
const { recalcularTitulos } = require("../../services/recebiveis");
const { registrarEventoFinanceiro } = require("../../services/financeiroEventos");
const {
  findPagamentoById,
  deletePagamentoById,
} = require("../../infra/prisma/repositories/pagamentoRepository");

async function excluirPagamento(prisma, pagamentoId) {
  return prisma.$transaction(async (tx) => {
    const pagamento = await findPagamentoById(tx, pagamentoId);
    if (!pagamento) {
      throw new AppError("Pagamento não encontrado", {
        code: "PAGAMENTO_NAO_ENCONTRADO",
        httpStatus: 404,
      });
    }

    await deletePagamentoById(tx, pagamentoId);
    await registrarEventoFinanceiro(tx, {
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
