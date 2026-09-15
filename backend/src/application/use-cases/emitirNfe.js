const { AppError } = require("../../shared/errors/appError");
const { validarPreEmissaoNfe } = require("../../domain/nfe/validarPreEmissao");
const { montarPayloadFocus, aplicarRespostaProvedor } = require("../../domain/nfe/montarPayload");
const {
  STATUS,
  statusPermiteReemissao,
} = require("../../domain/nfe/constants");
const {
  notaBloqueanteDaVenda,
  ultimaNotaDaVenda,
} = require("../../domain/nfe/notaDaVenda");
const { createNfeProvider } = require("../../infra/nfe/provider");
const {
  refNfeTentativa,
  isErroInconclusivoNfe,
  statusPermiteReutilizarRef,
} = require("../../domain/nfe/refNfe");
const { sincronizarNotaSeProcessando } = require("./gerirNfe");

function produtosMap(produtos) {
  return new Map(produtos.map((p) => [p.id, p]));
}

async function carregarContextoEmissao(prisma, { tenantId, vendaId }) {
  const [emitente, venda] = await Promise.all([
    prisma.emitenteFiscal.findUnique({ where: { tenantId } }),
    prisma.venda.findFirst({
      where: { id: vendaId, tenantId },
      include: {
        cliente: true,
        motorista: true,
        itens: true,
      },
    }),
  ]);
  if (!venda) {
    throw new AppError("Venda não encontrada", {
      code: "VENDA_NAO_ENCONTRADA",
      httpStatus: 404,
    });
  }
  const produtoIds = [...new Set(venda.itens.map((i) => i.produtoId))];
  const produtos = await prisma.produto.findMany({
    where: { tenantId, id: { in: produtoIds } },
  });
  return { emitente, venda, produtosPorId: produtosMap(produtos) };
}

async function validarEmissaoNfe(prisma, { tenantId, vendaId }) {
  const ctx = await carregarContextoEmissao(prisma, { tenantId, vendaId });
  return validarPreEmissaoNfe({
    emitente: ctx.emitente,
    cliente: ctx.venda.cliente,
    itens: ctx.venda.itens,
    produtosPorId: ctx.produtosPorId,
  });
}

async function proximaRefNfe(prisma, { tenantId, vendaId }) {
  const count = await prisma.notaFiscal.count({ where: { tenantId, vendaId } });
  return refNfeTentativa(tenantId, vendaId, count + 1);
}

async function emitirNfe(prisma, { tenantId, vendaId, provider, audit } = {}) {
  const ctx = await carregarContextoEmissao(prisma, { tenantId, vendaId });
  const nfeProvider = provider || createNfeProvider({ emitente: ctx.emitente });

  const bloqueante = await notaBloqueanteDaVenda(prisma, { tenantId, vendaId });
  if (bloqueante?.status === STATUS.AUTORIZADA) {
    throw new AppError("Esta venda já possui NF-e autorizada.", {
      code: "NFE_JA_EXISTE",
      httpStatus: 409,
    });
  }

  let notaReuso = null;
  if (bloqueante?.status === STATUS.PROCESSANDO) {
    const sync = await sincronizarNotaSeProcessando(prisma, {
      nota: bloqueante,
      provider: nfeProvider,
      emitente: ctx.emitente,
    });
    if (sync.kind === "ok") {
      if (
        sync.nota.status === STATUS.AUTORIZADA ||
        sync.nota.status === STATUS.PROCESSANDO
      ) {
        return sync.nota;
      }
      if (!statusPermiteReemissao(sync.nota.status)) {
        throw new AppError("Esta venda já possui uma NF-e em andamento.", {
          code: "NFE_JA_EXISTE",
          httpStatus: 409,
        });
      }
    } else if (sync.kind === "incerto") {
      throw new AppError(
        "A emissão anterior pode ter sido aceita pelo provedor. Consulte o status antes de emitir de novo.",
        { code: "NFE_STATUS_INCERTO", httpStatus: 503 },
      );
    } else if (sync.kind === "ausente") {
      notaReuso = sync.nota;
    }
  }

  const ultima = await ultimaNotaDaVenda(prisma, { tenantId, vendaId });
  if (
    !notaReuso &&
    ultima &&
    !statusPermiteReemissao(ultima.status) &&
    !statusPermiteReutilizarRef(ultima.status)
  ) {
    throw new AppError("Esta venda já possui uma NF-e em andamento.", {
      code: "NFE_JA_EXISTE",
      httpStatus: 409,
    });
  }

  const validacao = validarPreEmissaoNfe({
    emitente: ctx.emitente,
    cliente: ctx.venda.cliente,
    itens: ctx.venda.itens,
    produtosPorId: ctx.produtosPorId,
  });
  if (!validacao.ok) {
    throw new AppError("Cadastro fiscal incompleto. Corrija os itens antes de emitir.", {
      code: "NFE_CADASTRO_INCOMPLETO",
      httpStatus: 400,
      details: validacao.erros,
    });
  }

  const payload = montarPayloadFocus({
    emitente: ctx.emitente,
    cliente: ctx.venda.cliente,
    itens: ctx.venda.itens,
    produtosPorId: ctx.produtosPorId,
    motorista: ctx.venda.motorista,
    venda: ctx.venda,
  });

  let nota = notaReuso;
  if (!nota && ultima && ultima.status === STATUS.RASCUNHO) {
    nota = ultima;
  }

  const ref = nota
    ? nota.refProvedor
    : await proximaRefNfe(prisma, { tenantId, vendaId });

  if (nota) {
    nota = await prisma.notaFiscal.update({
      where: { id: nota.id },
      data: {
        status: STATUS.PROCESSANDO,
        payloadEnviado: payload,
        emitidaEm: new Date(),
        motivoRejeicao: null,
      },
    });
  } else {
    try {
      nota = await prisma.notaFiscal.create({
        data: {
          tenantId,
          vendaId,
          status: STATUS.PROCESSANDO,
          refProvedor: ref,
          payloadEnviado: payload,
          emitidaEm: new Date(),
        },
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      const existing = await prisma.notaFiscal.findFirst({
        where: { tenantId, vendaId, refProvedor: ref },
      });
      if (!existing) throw error;
      if (existing.status === STATUS.AUTORIZADA) return existing;
      nota = existing;
    }
  }

  try {
    const resposta = await nfeProvider.emitir({ ref: nota.refProvedor, payload });
    const patch = aplicarRespostaProvedor(resposta);
    const atualizada = await prisma.notaFiscal.update({
      where: { id: nota.id },
      data: {
        status: patch.status || STATUS.PROCESSANDO,
        serie: patch.serie ?? undefined,
        numero: patch.numero ?? undefined,
        chaveAcesso: patch.chaveAcesso ?? undefined,
        protocolo: patch.protocolo ?? undefined,
        motivoRejeicao: patch.motivoRejeicao ?? undefined,
        xmlUrl: patch.xmlUrl ?? undefined,
        danfeUrl: patch.danfeUrl ?? undefined,
        payloadResposta: patch.payloadResposta ?? undefined,
        autorizadaEm: patch.autorizadaEm ?? undefined,
      },
    });
    if (audit) {
      await audit({
        tipo: "NFE_EMITIDA",
        entidade: "NotaFiscal",
        entidadeId: atualizada.id,
        vendaId,
        payload: { status: atualizada.status, refProvedor: nota.refProvedor },
      });
    }
    return atualizada;
  } catch (err) {
    if (isErroInconclusivoNfe(err)) {
      await prisma.notaFiscal.update({
        where: { id: nota.id },
        data: {
          status: STATUS.PROCESSANDO,
          motivoRejeicao:
            "Resposta inconclusiva do provedor. Consulte o status antes de emitir novamente.",
          payloadResposta: {
            error: err.message,
            details: err.details || null,
            inconclusivo: true,
          },
        },
      });
      throw new AppError(
        "A NF-e pode ter sido aceita pelo provedor. Consulte o status antes de tentar emitir de novo.",
        { code: "NFE_STATUS_INCERTO", httpStatus: 503, details: err.details },
      );
    }
    await prisma.notaFiscal.update({
      where: { id: nota.id },
      data: {
        status: STATUS.REJEITADA,
        motivoRejeicao: err.message || "Falha na emissão",
        payloadResposta: { error: err.message, details: err.details || null },
      },
    });
    throw err;
  }
}

module.exports = {
  validarEmissaoNfe,
  emitirNfe,
  carregarContextoEmissao,
  proximaRefNfe,
};
