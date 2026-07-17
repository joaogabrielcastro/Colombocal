const { AppError } = require("../../shared/errors/appError");
const { calcularSaldoAbertoVenda, splitValorComTroco } = require("../../domain/financeiro");
const { recalcularTodosTitulosCliente } = require("../../services/recebiveis");
const { registrarEventoFinanceiro } = require("../../services/financeiroEventos");
const { findVendaFinanceiraById } = require("../../infra/prisma/repositories/vendaRepository");
const { createPagamento } = require("../../infra/prisma/repositories/pagamentoRepository");
const { createCheque, findChequeById } = require("../../infra/prisma/repositories/chequeRepository");
const {
  assertClienteDoTenant,
  assertVendaDoTenant,
} = require("../../utils/tenantOwnership");

async function registrarCheque(prisma, payload) {
  const tenantId = payload.tenantId;
  if (tenantId == null) {
    throw new AppError("tenantId ausente", { code: "TENANT_REQUIRED", httpStatus: 500 });
  }

  const dataRecebimentoDate =
    payload.dataRecebimento instanceof Date
      ? payload.dataRecebimento
      : payload.dataRecebimento
        ? new Date(payload.dataRecebimento)
        : new Date();
  const dataPagamento = dataRecebimentoDate;

  const result = await prisma.$transaction(async (tx) => {
    await assertClienteDoTenant(tx, payload.clienteId, tenantId);
    await assertVendaDoTenant(tx, payload.vendaId, tenantId, {
      clienteId: payload.clienteId,
    });

    let valorPrincipal = payload.valor;
    let trocoValor = 0;

    if (payload.vendaId) {
      const venda = await findVendaFinanceiraById(tx, payload.vendaId, tenantId);
      if (venda) {
        const saldoAberto = calcularSaldoAbertoVenda(venda);
        if (payload.valor > saldoAberto) {
          if (!payload.trocoTipo) {
            throw new AppError(
              "Valor do cheque ultrapassa o saldo da venda. Informe trocoTipo (dinheiro ou transferencia/pix).",
              { code: "CHEQUE_EXCEDE_SALDO", httpStatus: 400 },
            );
          }
          const split = splitValorComTroco(payload.valor, saldoAberto);
          trocoValor = split.trocoValor;
          valorPrincipal = split.valorPrincipal;
        }
      }
    }

    const novoCheque = await createCheque(
      tx,
      {
        tenantId,
        clienteId: payload.clienteId,
        vendaId: payload.vendaId ?? null,
        valor: payload.valor,
        emitenteNome: payload.emitenteNome ?? null,
        banco: payload.banco ?? null,
        numero: payload.numero ?? null,
        agencia: payload.agencia ?? null,
        conta: payload.conta ?? null,
        dataRecebimento: dataPagamento,
        dataCompensacao: dataPagamento,
        status: "registrado",
        observacoes: payload.observacoes ?? null,
      },
      { useSavepoint: true },
    );

    await createPagamento(tx, {
      tenantId,
      clienteId: payload.clienteId,
      vendaId: novoCheque.vendaId,
      tipo: "cheque",
      valor: valorPrincipal,
      data: dataPagamento,
      chequeId: novoCheque.id,
      observacoes: `Cheque #${payload.numero || novoCheque.id} - ${payload.banco || ""}`,
    });

    if (trocoValor > 0.0001) {
      const trocoTipo = payload.trocoTipo || "dinheiro";
      await createPagamento(tx, {
        tenantId,
        clienteId: payload.clienteId,
        vendaId: novoCheque.vendaId,
        tipo: `troco_${trocoTipo}`,
        valor: -trocoValor,
        data: dataPagamento,
        observacoes:
          `Troco de cheque da venda #${novoCheque.vendaId} ` +
          `(${trocoTipo === "transferencia" ? "pix/transferência" : "dinheiro"})`,
      });
    }

    await recalcularTodosTitulosCliente(tx, payload.clienteId);
    await registrarEventoFinanceiro(tx, {
      tenantId,
      auditActor: payload.auditActor,
      tipo: "CHEQUE_CRIADO",
      entidade: "Cheque",
      entidadeId: novoCheque.id,
      chequeId: novoCheque.id,
      clienteId: payload.clienteId,
      vendaId: novoCheque.vendaId,
      valor: payload.valor,
      payload: {
        status: "registrado",
        banco: payload.banco || null,
        trocoValor,
        trocoTipo: trocoValor > 0.0001 ? (payload.trocoTipo || "dinheiro") : null,
      },
    });

    return {
      chequeId: novoCheque.id,
      trocoValor,
      trocoTipo: trocoValor > 0.0001 ? (payload.trocoTipo || "dinheiro") : null,
    };
  });

  const chequeCompleto = await findChequeById(prisma, result.chequeId, tenantId, {
    cliente: true,
    venda: true,
    pagamento: true,
  });

  return {
    cheque: chequeCompleto,
    trocoValor: result.trocoValor,
    trocoTipo: result.trocoTipo,
  };
}

module.exports = { registrarCheque };
