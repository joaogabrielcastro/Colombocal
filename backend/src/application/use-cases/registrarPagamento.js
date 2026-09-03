const { AppError } = require("../../shared/errors/appError");
const { calcularSaldoAbertoVenda, splitValorComTroco } = require("../../domain/financeiro");
const { recalcularTodosTitulosCliente } = require("../../services/recebiveis");
const { registrarEventoFinanceiro } = require("../../services/financeiroEventos");
const { findVendaFinanceiraById } = require("../../infra/prisma/repositories/vendaRepository");
const { createPagamento } = require("../../infra/prisma/repositories/pagamentoRepository");
const {
  assertClienteDoTenant,
  assertVendaDoTenant,
} = require("../../utils/tenantOwnership");
const { parseDateField } = require("../../utils/validation");

async function registrarPagamento(prisma, payload) {
  const tenantId = payload.tenantId;
  if (tenantId == null) {
    throw new AppError("tenantId ausente", { code: "TENANT_REQUIRED", httpStatus: 500 });
  }

  if (payload.tipo === "cheque") {
    throw new AppError("Para cheques, use a rota /api/cheques", {
      code: "PAGAMENTO_TIPO_INVALIDO",
      httpStatus: 400,
    });
  }

  const dataPagamento = payload.data
    ? parseDateField(payload.data, "data")
    : new Date();

  return prisma.$transaction(async (tx) => {
    await assertClienteDoTenant(tx, payload.clienteId, tenantId);
    await assertVendaDoTenant(tx, payload.vendaId, tenantId, {
      clienteId: payload.clienteId,
    });

    let trocoValor = 0;

    if (payload.vendaId) {
      const venda = await findVendaFinanceiraById(tx, payload.vendaId, tenantId);
      if (venda) {
        const saldoAberto = calcularSaldoAbertoVenda(venda);
        const split = splitValorComTroco(payload.valor, saldoAberto);
        trocoValor = split.trocoValor;
      }
    }

    const novoPagamento = await createPagamento(
      tx,
      {
        tenantId,
        clienteId: payload.clienteId,
        vendaId: payload.vendaId ?? null,
        tipo: payload.tipo,
        // Valor recebido (integral). O excesso vira lançamento de troco negativo,
        // alinhado ao lote de cheques — assim o recálculo não apaga o troco legítimo.
        valor: payload.valor,
        data: dataPagamento,
        observacoes: payload.observacoes,
      },
      { cliente: true, venda: true },
    );

    if (trocoValor > 0) {
      const trocoTipo = payload.trocoTipo || payload.tipo;
      await createPagamento(tx, {
        tenantId,
        clienteId: payload.clienteId,
        vendaId: payload.vendaId ?? null,
        tipo: `troco_${trocoTipo}`,
        valor: -trocoValor,
        data: dataPagamento,
        observacoes:
          (payload.observacoes ? `${payload.observacoes} · ` : "") +
          `Troco devolvido (${trocoTipo})`,
      });
    }

    await recalcularTodosTitulosCliente(tx, payload.clienteId);
    await registrarEventoFinanceiro(tx, {
      tenantId,
      auditActor: payload.auditActor,
      tipo: "PAGAMENTO_CRIADO",
      entidade: "Pagamento",
      entidadeId: novoPagamento.id,
      pagamentoId: novoPagamento.id,
      clienteId: payload.clienteId,
      vendaId: payload.vendaId ?? null,
      valor: payload.valor,
      payload: { tipo: payload.tipo, trocoValor, trocoTipo: payload.trocoTipo || null },
    });

    return novoPagamento;
  });
}

module.exports = { registrarPagamento };
