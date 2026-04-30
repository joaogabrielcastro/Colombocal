const { AppError } = require("../../shared/errors/appError");
const { recalcularTitulos } = require("../../services/recebiveis");
const { registrarEventoFinanceiro } = require("../../services/financeiroEventos");
const {
  deletePagamentosByChequeId,
} = require("../../infra/prisma/repositories/pagamentoRepository");
const {
  findChequeById,
  deleteChequeById,
} = require("../../infra/prisma/repositories/chequeRepository");

async function excluirCheque(prisma, chequeId) {
  return prisma.$transaction(async (tx) => {
    const cheque = await findChequeById(tx, chequeId, { pagamento: true });
    if (!cheque) {
      throw new AppError("Cheque não encontrado", {
        code: "CHEQUE_NAO_ENCONTRADO",
        httpStatus: 404,
      });
    }

    await deletePagamentosByChequeId(tx, chequeId);
    await deleteChequeById(tx, chequeId);
    await registrarEventoFinanceiro(tx, {
      tipo: "CHEQUE_EXCLUIDO",
      entidade: "Cheque",
      entidadeId: cheque.id,
      chequeId: cheque.id,
      clienteId: cheque.clienteId,
      vendaId: cheque.vendaId,
      valor: parseFloat(cheque.valor),
    });

    await recalcularTitulos(tx, {
      clienteId: cheque.clienteId,
      vendaId: cheque.vendaId,
    });
  });
}

module.exports = { excluirCheque };
