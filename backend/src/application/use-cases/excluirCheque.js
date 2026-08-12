const { AppError } = require("../../shared/errors/appError");
const { recalcularTitulos } = require("../../services/recebiveis");
const { registrarEventoFinanceiro } = require("../../services/financeiroEventos");
const {
  limparTrocosOrfaosDoRecebimento,
} = require("../../domain/financeiro/limparTrocosOrfaos");
const {
  deletePagamentosByChequeId,
} = require("../../infra/prisma/repositories/pagamentoRepository");
const {
  findChequeById,
  deleteChequeById,
} = require("../../infra/prisma/repositories/chequeRepository");

async function excluirCheque(prisma, chequeId, tenantId, auditActor) {
  if (tenantId == null) {
    throw new AppError("tenantId ausente", { code: "TENANT_REQUIRED", httpStatus: 500 });
  }
  return prisma.$transaction(async (tx) => {
    const cheque = await findChequeById(tx, chequeId, tenantId, { pagamento: true });
    if (!cheque) {
      throw new AppError("Cheque não encontrado", {
        code: "CHEQUE_NAO_ENCONTRADO",
        httpStatus: 404,
      });
    }

    const dataRef =
      cheque.pagamento?.data ||
      cheque.dataRecebimento ||
      cheque.createdAt ||
      new Date();

    await deletePagamentosByChequeId(tx, chequeId, tenantId);
    await deleteChequeById(tx, chequeId, tenantId);

    await limparTrocosOrfaosDoRecebimento(tx, {
      tenantId,
      vendaId: cheque.vendaId ?? null,
      clienteId: cheque.clienteId,
      dataRef,
    });

    await registrarEventoFinanceiro(tx, {
      tenantId,
      auditActor,
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
