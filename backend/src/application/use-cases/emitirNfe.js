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

async function emitirNfe(prisma, { tenantId, vendaId, provider, audit } = {}) {
  const ctx = await carregarContextoEmissao(prisma, { tenantId, vendaId });
  const bloqueante = await notaBloqueanteDaVenda(prisma, { tenantId, vendaId });
  if (bloqueante) {
    throw new AppError(
      bloqueante.status === STATUS.AUTORIZADA
        ? "Esta venda já possui NF-e autorizada."
        : "Há uma NF-e em processamento para esta venda. Aguarde ou consulte o status.",
      { code: "NFE_JA_EXISTE", httpStatus: 409 },
    );
  }

  const ultima = await ultimaNotaDaVenda(prisma, { tenantId, vendaId });
  if (ultima && !statusPermiteReemissao(ultima.status) && ultima.status !== STATUS.RASCUNHO) {
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
    venda: ctx.venda,
    itens: ctx.venda.itens,
    produtosPorId: ctx.produtosPorId,
    motorista: ctx.venda.motorista,
  });

  const ref = `venda-${tenantId}-${vendaId}-${Date.now()}`;
  const nfeProvider = provider || createNfeProvider({ emitente: ctx.emitente });

  const nota = await prisma.notaFiscal.create({
    data: {
      tenantId,
      vendaId,
      status: STATUS.PROCESSANDO,
      refProvedor: ref,
      payloadEnviado: payload,
      emitidaEm: new Date(),
    },
  });

  try {
    const resposta = await nfeProvider.emitir({ ref, payload });
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
        payload: { status: atualizada.status, refProvedor: ref },
      });
    }
    return atualizada;
  } catch (err) {
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
};
