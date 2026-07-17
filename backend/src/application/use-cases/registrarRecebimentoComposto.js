const { AppError } = require("../../shared/errors/appError");
const { calcularSaldoAbertoVenda } = require("../../domain/financeiro");
const { recalcularTitulos } = require("../../services/recebiveis");
const { registrarEventoFinanceiro } = require("../../services/financeiroEventos");
const { findVendaFinanceiraById } = require("../../infra/prisma/repositories/vendaRepository");
const { createPagamento } = require("../../infra/prisma/repositories/pagamentoRepository");
const { createCheque, getNextNumeroOrdem } = require("../../infra/prisma/repositories/chequeRepository");
const {
  assertClienteDoTenant,
  assertVendaDoTenant,
} = require("../../utils/tenantOwnership");

function toNumber(value) {
  const n = parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function parseDataInput(value) {
  if (value instanceof Date) return value;
  if (value) return new Date(value);
  return new Date();
}

async function registrarRecebimentoComposto(prisma, payload) {
  const tenantId = payload.tenantId;
  if (tenantId == null) {
    throw new AppError("tenantId ausente", { code: "TENANT_REQUIRED", httpStatus: 500 });
  }

  const clienteId = payload.clienteId;
  const vendaId = payload.vendaId;
  const cheques = payload.cheques ?? [];
  const dinheiro = payload.dinheiro ?? null;
  const pix = payload.pix ?? null;

  return prisma.$transaction(async (tx) => {
    await assertClienteDoTenant(tx, clienteId, tenantId);
    await assertVendaDoTenant(tx, vendaId, tenantId, { clienteId });

    const venda = await findVendaFinanceiraById(tx, vendaId, tenantId);
    if (!venda) {
      throw new AppError("Venda não encontrada", { code: "VENDA_NAO_ENCONTRADA", httpStatus: 404 });
    }

    const totalCheques = cheques.reduce((acc, item) => acc + toNumber(item.valor), 0);
    const totalDinheiro = dinheiro ? toNumber(dinheiro.valor) : 0;
    const totalPix = pix ? toNumber(pix.valor) : 0;
    const totalGeral = totalCheques + totalDinheiro + totalPix;

    if (totalGeral < 0.01) {
      throw new AppError("Informe ao menos um valor de recebimento", {
        code: "RECEBIMENTO_VAZIO",
        httpStatus: 400,
      });
    }

    const saldoAberto = calcularSaldoAbertoVenda(venda);
    const excedente = Math.max(0, totalGeral - saldoAberto);
    if (excedente > 0.0001 && !payload.trocoTipo) {
      throw new AppError(
        "Total do recebimento ultrapassa o saldo da venda. Informe trocoTipo (dinheiro ou transferencia/pix).",
        { code: "RECEBIMENTO_EXCEDE_SALDO", httpStatus: 400 },
      );
    }

    const chequesCriados = [];
    let pagamentosCriados = 0;

    if (cheques.length > 0) {
      let nextNumeroOrdem = await getNextNumeroOrdem(tx, tenantId);
      for (const item of cheques) {
        const dataPagamento = parseDataInput(item.dataRecebimento);

        const novoCheque = await createCheque(
          tx,
          {
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
          },
          { numeroOrdem: nextNumeroOrdem++, useSavepoint: true },
        );

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
        pagamentosCriados += 1;

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
          payload: { emitenteNome: item.emitenteNome, banco: item.banco || null, composto: true },
        });

        chequesCriados.push(novoCheque);
      }
    }

    if (dinheiro) {
      const dataPagamento = parseDataInput(dinheiro.data);
      const novoPagamento = await createPagamento(tx, {
        tenantId,
        clienteId,
        vendaId,
        tipo: "dinheiro",
        valor: dinheiro.valor,
        data: dataPagamento,
        observacoes: dinheiro.observacoes ?? null,
      });
      pagamentosCriados += 1;

      await registrarEventoFinanceiro(tx, {
        tenantId,
        auditActor: payload.auditActor,
        tipo: "PAGAMENTO_CRIADO",
        entidade: "Pagamento",
        entidadeId: novoPagamento.id,
        pagamentoId: novoPagamento.id,
        clienteId,
        vendaId,
        valor: dinheiro.valor,
        payload: { tipo: "dinheiro", composto: true },
      });
    }

    if (pix) {
      const dataPagamento = parseDataInput(pix.data);
      const novoPagamento = await createPagamento(tx, {
        tenantId,
        clienteId,
        vendaId,
        tipo: "transferencia",
        valor: pix.valor,
        data: dataPagamento,
        observacoes: pix.observacoes ?? null,
      });
      pagamentosCriados += 1;

      await registrarEventoFinanceiro(tx, {
        tenantId,
        auditActor: payload.auditActor,
        tipo: "PAGAMENTO_CRIADO",
        entidade: "Pagamento",
        entidadeId: novoPagamento.id,
        pagamentoId: novoPagamento.id,
        clienteId,
        vendaId,
        valor: pix.valor,
        payload: { tipo: "transferencia", composto: true },
      });
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
          `Troco do recebimento composto da venda #${vendaId} ` +
          `(${trocoTipo === "transferencia" ? "pix/transferência" : "dinheiro"})`,
      });
      pagamentosCriados += 1;
    }

    await recalcularTitulos(tx, { clienteId, vendaId });

    return {
      chequesCriados: chequesCriados.length,
      pagamentosCriados,
      totalGeral,
      saldoAbertoAntes: saldoAberto,
      excedente,
      trocoTipo: excedente > 0.0001 ? (payload.trocoTipo || "dinheiro") : null,
      resumo: {
        cheques: totalCheques,
        dinheiro: totalDinheiro,
        pix: totalPix,
      },
    };
  });
}

module.exports = { registrarRecebimentoComposto };
