const { AppError } = require("../../shared/errors/appError");
const { validarPreEmissaoNfe } = require("../../domain/nfe/validarPreEmissao");
const { montarPayloadFocus, montarPayloadNotaas, aplicarRespostaProvedor } = require("../../domain/nfe/montarPayload");
const {
  STATUS,
  statusPermiteReemissao,
} = require("../../domain/nfe/constants");
const {
  notaBloqueanteDaVenda,
  ultimaNotaDaVenda,
} = require("../../domain/nfe/notaDaVenda");
const { createNfeProvider, resolveProviderName } = require("../../infra/nfe/provider");
const { hasFiscalTokenConfigured } = require("../../infra/crypto/fiscalTokenCrypto");
const {
  refNfeTentativa,
  isErroInconclusivoNfe,
  statusPermiteReutilizarRef,
} = require("../../domain/nfe/refNfe");
const { sincronizarNotaSeProcessando } = require("./gerirNfe");
const { buscarEmitenteFiscal } = require("../../services/emitenteFiscal");
const { randomUUID } = require("node:crypto");
const { auditarSemFalhar } = require("../../services/fiscal/auditoriaFiscal");

function produtosMap(produtos) {
  return new Map(produtos.map((p) => [p.id, p]));
}

async function carregarContextoEmissao(prisma, { tenantId, vendaId, emitenteFiscalId }) {
  const [emitente, venda] = await Promise.all([
    buscarEmitenteFiscal(prisma, {
      tenantId,
      emitenteFiscalId,
      recurso: "nfe",
      obrigatorio: true,
    }),
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

async function validarEmissaoNfe(prisma, { tenantId, vendaId, emitenteFiscalId }) {
  const ctx = await carregarContextoEmissao(prisma, { tenantId, vendaId, emitenteFiscalId });
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

async function emitirNfe(
  prisma,
  { tenantId, vendaId, emitenteFiscalId, provider, audit } = {},
) {
  const ctx = await carregarContextoEmissao(prisma, {
    tenantId,
    vendaId,
    emitenteFiscalId,
  });
  const providerName = resolveProviderName(ctx.emitente);
  if (providerName !== "mock") {
    const quantidadeEmitentes = await prisma.emitenteFiscal.count({
      where: { tenantId, ativo: true, habilitaNfe: true },
    });
    if (quantidadeEmitentes > 1 && !hasFiscalTokenConfigured(ctx.emitente.provedorToken)) {
      throw new AppError(
        "Configure a credencial do provedor específica desta empresa antes de emitir.",
        { code: "NFE_TOKEN_EMITENTE_OBRIGATORIO", httpStatus: 400 },
      );
    }
  }
  const nfeProvider = provider || createNfeProvider({ emitente: ctx.emitente });

  const bloqueante = await notaBloqueanteDaVenda(prisma, { tenantId, vendaId });
  if (
    bloqueante?.emitenteFiscalId &&
    bloqueante.emitenteFiscalId !== ctx.emitente.id
  ) {
    throw new AppError("A emissão em andamento pertence a outra empresa emissora.", {
      code: "NFE_EMITENTE_DIVERGENTE",
      httpStatus: 409,
    });
  }
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
      notaReuso = await prisma.notaFiscal.update({
        where: { id: sync.nota.id },
        data: { status: STATUS.RASCUNHO, claimEmissao: null },
      });
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

  const montarPayload = providerName === "notaas" ? montarPayloadNotaas : montarPayloadFocus;
  const payload = montarPayload({
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

  const claimEmissao = randomUUID();

  if (nota) {
    const claimed = await prisma.notaFiscal.updateMany({
      where: { id: nota.id, tenantId, claimEmissao: null },
      data: {
        status: STATUS.PROCESSANDO,
        claimEmissao,
        emitenteFiscalId: ctx.emitente.id,
        emitenteNome: ctx.emitente.razaoSocial,
        emitenteCnpj: ctx.emitente.cnpj,
        payloadEnviado: payload,
        emitidaEm: new Date(),
        motivoRejeicao: null,
      },
    });
    if (claimed.count !== 1) {
      throw new AppError("Outra emissÃ£o desta NF-e jÃ¡ estÃ¡ em andamento.", {
        code: "NFE_EMISSAO_CONCORRENTE",
        httpStatus: 409,
      });
    }
    nota = await prisma.notaFiscal.findFirst({ where: { id: nota.id, tenantId } });
  } else {
    try {
      nota = await prisma.notaFiscal.create({
        data: {
          tenantId,
          vendaId,
          emitenteFiscalId: ctx.emitente.id,
          emitenteNome: ctx.emitente.razaoSocial,
          emitenteCnpj: ctx.emitente.cnpj,
          status: STATUS.PROCESSANDO,
          claimEmissao,
          refProvedor: ref,
          payloadEnviado: payload,
          emitidaEm: new Date(),
        },
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      const existing = await prisma.notaFiscal.findFirst({
        where: { tenantId, vendaId, status: { in: [STATUS.RASCUNHO, STATUS.PROCESSANDO, STATUS.AUTORIZADA] } },
      });
      if (!existing) throw error;
      if (existing.status === STATUS.AUTORIZADA) return existing;
      throw new AppError("Outra emissÃ£o desta venda jÃ¡ estÃ¡ em andamento.", {
        code: "NFE_EMISSAO_CONCORRENTE",
        httpStatus: 409,
      });
    }
  }

  try {
    const resposta = await nfeProvider.emitir({ ref: nota.refProvedor, payload });
    const patch = aplicarRespostaProvedor(resposta);
    const statusAnterior = nota.status;
    const atualizada = await prisma.notaFiscal.update({
      where: { id: nota.id },
      data: {
        status: patch.status || STATUS.PROCESSANDO,
        refProvedor: patch.refProvedor ?? undefined,
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
    await auditarSemFalhar(audit, {
        tipo: "NFE_EMITIDA",
        entidade: "NotaFiscal",
        entidadeId: atualizada.id,
        vendaId,
        payload: { status: atualizada.status, refProvedor: nota.refProvedor },
    });
    const { onNfeAutorizada } = require("../../domain/nfe/onNfeAutorizada");
    await onNfeAutorizada(prisma, {
      tenantId,
      vendaId,
      statusAnterior,
      statusNovo: atualizada.status,
    });
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
