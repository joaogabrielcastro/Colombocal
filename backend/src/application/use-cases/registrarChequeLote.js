const { AppError } = require("../../shared/errors/appError");
const { calcularSaldoAbertoVenda } = require("../../domain/financeiro");
const { recalcularTitulos } = require("../../services/recebiveis");
const { registrarEventoFinanceiro } = require("../../services/financeiroEventos");
const { findVendaFinanceiraById } = require("../../infra/prisma/repositories/vendaRepository");
const { createPagamento } = require("../../infra/prisma/repositories/pagamentoRepository");
const { createCheque } = require("../../infra/prisma/repositories/chequeRepository");
const {
  assertClienteDoTenant,
  assertVendaDoTenant,
} = require("../../utils/tenantOwnership");

async function registrarChequeLote(prisma, payload) {
  const tenantId = payload.tenantId;
  if (tenantId == null) {
    throw new AppError("tenantId ausente", { code: "TENANT_REQUIRED", httpStatus: 500 });
  }

  const clienteId = payload.clienteId;
  const vendaId = payload.vendaId;

  return prisma.$transaction(async (tx) => {
    await assertClienteDoTenant(tx, clienteId, tenantId);
    await assertVendaDoTenant(tx, vendaId, tenantId, { clienteId });

    const venda = await findVendaFinanceiraById(tx, vendaId, tenantId);
    if (!venda) {
      throw new AppError("Venda não encontrada", { code: "VENDA_NAO_ENCONTRADA", httpStatus: 404 });
    }

    const totalLote = payload.itens.reduce((acc, item) => acc + Number(item.valor), 0);
    const saldoAberto = calcularSaldoAbertoVenda(venda);
    const excedente = Math.max(0, totalLote - saldoAberto);
    if (excedente > 0.0001 && !payload.trocoTipo) {
      throw new AppError(
        "Total do lote ultrapassa o saldo da venda. Informe trocoTipo (dinheiro ou transferencia/pix).",
        { code: "LOTE_EXCEDE_SALDO", httpStatus: 400 },
      );
    }

    const criados = [];
    for (const item of payload.itens) {
      const dataRecebimentoDate =
        item.dataRecebimento instanceof Date
          ? item.dataRecebimento
          : item.dataRecebimento
            ? new Date(item.dataRecebimento)
            : new Date();
      const dataPagamento = dataRecebimentoDate;

      const novoCheque = await createCheque(tx, {
        tenantId,
        clienteId,
        vendaId,
        valor: item.valor,
        emitenteNome: item.emitenteNome,
        banco: item.banco ?? null,
        numero: item.numero ?? null,
        agencia: item.agencia ?? null,
        conta: item.conta ?? null,
        dataRecebimento: dataPagamento,
        dataCompensacao: dataPagamento,
        status: "registrado",
        observacoes: item.observacoes ?? null,
      });

      await createPagamento(tx, {
        tenantId,
        clienteId,
        vendaId,
        tipo: "cheque",
        valor: item.valor,
        data: dataPagamento,
        chequeId: novoCheque.id,
        observacoes: `Cheque #${item.numero || novoCheque.id} - ${item.banco || ""}`,
      });

      await registrarEventoFinanceiro(tx, {
        tenantId,
        auditActor: payload.auditActor,
        tipo: "CHEQUE_CRIADO_LOTE",
        entidade: "Cheque",
        entidadeId: novoCheque.id,
        chequeId: novoCheque.id,
        clienteId,
        vendaId,
        valor: item.valor,
        payload: { emitenteNome: item.emitenteNome, banco: item.banco || null },
      });

      criados.push(novoCheque);
    }

    if (excedente > 0.0001) {
      const trocoTipo = payload.trocoTipo || "dinheiro";
      await createPagamento(tx, {
        tenantId,
        clienteId,
        vendaId,
        tipo: `troco_${trocoTipo}`,
        valor: -excedente,
        data: new Date(),
        observacoes:
          `Troco do lote de cheques da venda #${vendaId} ` +
          `(${trocoTipo === "transferencia" ? "pix/transferência" : "dinheiro"})`,
      });
    }

    await recalcularTitulos(tx, { clienteId, vendaId });
    return {
      chequesCriados: criados.length,
      totalLote,
      saldoAbertoAntes: saldoAberto,
      excedente,
      trocoTipo: excedente > 0.0001 ? (payload.trocoTipo || "dinheiro") : null,
    };
  });
}

module.exports = { registrarChequeLote };
