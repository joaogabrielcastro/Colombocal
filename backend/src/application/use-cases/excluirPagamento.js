const { AppError } = require("../../shared/errors/appError");
const { recalcularTitulos } = require("../../services/recebiveis");
const { registrarEventoFinanceiro } = require("../../services/financeiroEventos");
const {
  limparTrocosOrfaosDoRecebimento,
} = require("../../domain/financeiro/limparTrocosOrfaos");
const {
  findPagamentoById,
  deletePagamentoById,
} = require("../../infra/prisma/repositories/pagamentoRepository");

async function excluirPagamento(prisma, pagamentoId, tenantId, auditActor) {
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

    const eraPositivo = parseFloat(String(pagamento.valor)) > 0;
    const dataRef = pagamento.data || pagamento.createdAt || new Date();

    await deletePagamentoById(tx, pagamentoId, tenantId);

    if (eraPositivo) {
      await limparTrocosOrfaosDoRecebimento(tx, {
        tenantId,
        vendaId: pagamento.vendaId ?? null,
        clienteId: pagamento.clienteId,
        dataRef,
      });
    }

    await registrarEventoFinanceiro(tx, {
      tenantId,
      auditActor,
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
