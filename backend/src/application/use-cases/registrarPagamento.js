const { AppError } = require("../../shared/errors/appError");
const { calcularSaldoAbertoVenda, splitValorComTroco } = require("../../domain/financeiro");
const { recalcularTodosTitulosCliente } = require("../../services/recebiveis");
const { registrarEventoFinanceiro } = require("../../services/financeiroEventos");
const { findVendaFinanceiraById } = require("../../infra/prisma/repositories/vendaRepository");
const { createPagamento } = require("../../infra/prisma/repositories/pagamentoRepository");

async function registrarPagamento(prisma, payload) {
  if (payload.tipo === "cheque") {
    throw new AppError("Para cheques, use a rota /api/cheques", {
      code: "PAGAMENTO_TIPO_INVALIDO",
      httpStatus: 400,
    });
  }

  const dataPagamento =
    payload.data instanceof Date
      ? payload.data
      : payload.data
        ? new Date(payload.data)
        : new Date();

  return prisma.$transaction(async (tx) => {
    let valorPrincipal = payload.valor;
    let trocoValor = 0;

    if (payload.vendaId) {
      const venda = await findVendaFinanceiraById(tx, payload.vendaId);
      if (venda) {
        const saldoAberto = calcularSaldoAbertoVenda(venda);
        const split = splitValorComTroco(payload.valor, saldoAberto);
        trocoValor = split.trocoValor;
        valorPrincipal = split.valorPrincipal;
      }
    }

    const novoPagamento = await createPagamento(
      tx,
      {
        clienteId: payload.clienteId,
        vendaId: payload.vendaId ?? null,
        tipo: payload.tipo,
        valor: valorPrincipal,
        data: dataPagamento,
        observacoes: payload.observacoes,
      },
      { cliente: true, venda: true },
    );

    if (trocoValor > 0) {
      const trocoTipo = payload.trocoTipo || payload.tipo;
      await createPagamento(tx, {
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
