const { AppError } = require("../../shared/errors/appError");
const { STATUS } = require("../../domain/nfe/constants");
const { aplicarRespostaProvedor } = require("../../domain/nfe/montarPayload");
const { createNfeProvider } = require("../../infra/nfe/provider");
const {
  isErroInconclusivoNfe,
  isNfeNaoEncontradaNoProvedor,
} = require("../../domain/nfe/refNfe");

function patchFromConsulta(nota, patch) {
  return {
    status: patch.status || nota.status,
    serie: patch.serie ?? undefined,
    numero: patch.numero ?? undefined,
    chaveAcesso: patch.chaveAcesso ?? undefined,
    protocolo: patch.protocolo ?? undefined,
    motivoRejeicao: patch.motivoRejeicao ?? undefined,
    xmlUrl: patch.xmlUrl ?? undefined,
    danfeUrl: patch.danfeUrl ?? undefined,
    payloadResposta: patch.payloadResposta ?? undefined,
    autorizadaEm: patch.autorizadaEm ?? undefined,
    canceladaEm: patch.canceladaEm ?? undefined,
  };
}

/**
 * Consulta o provedor para uma nota em processamento.
 * kind: ok | ausente | incerto
 */
async function sincronizarNotaSeProcessando(prisma, { nota, provider, emitente } = {}) {
  if (!nota || nota.status !== STATUS.PROCESSANDO) {
    return { kind: "skip", nota };
  }
  const nfeProvider = provider || createNfeProvider({ emitente });
  try {
    const resposta = await nfeProvider.consultar({ ref: nota.refProvedor });
    const patch = aplicarRespostaProvedor(resposta);
    const atualizada = await prisma.notaFiscal.update({
      where: { id: nota.id },
      data: patchFromConsulta(nota, patch),
    });
    return { kind: "ok", nota: atualizada };
  } catch (err) {
    if (isNfeNaoEncontradaNoProvedor(err)) {
      return { kind: "ausente", nota };
    }
    if (isErroInconclusivoNfe(err)) {
      return { kind: "incerto", nota, err };
    }
    throw err;
  }
}

async function cancelarNfe(prisma, { tenantId, vendaId, justificativa, provider, audit } = {}) {
  const justificativaTrim = String(justificativa || "").trim();
  if (justificativaTrim.length < 15) {
    throw new AppError("A justificativa do cancelamento deve ter ao menos 15 caracteres.", {
      code: "NFE_JUSTIFICATIVA",
      httpStatus: 400,
    });
  }

  const nota = await prisma.notaFiscal.findFirst({
    where: { tenantId, vendaId, status: STATUS.AUTORIZADA },
    orderBy: { createdAt: "desc" },
  });
  if (!nota) {
    throw new AppError("Não há NF-e autorizada para cancelar nesta venda.", {
      code: "NFE_NAO_AUTORIZADA",
      httpStatus: 400,
    });
  }

  const emitente = await prisma.emitenteFiscal.findUnique({ where: { tenantId } });
  const nfeProvider = provider || createNfeProvider({ emitente });
  const resposta = await nfeProvider.cancelar({
    ref: nota.refProvedor,
    justificativa: justificativaTrim,
  });
  const patch = aplicarRespostaProvedor(resposta);
  const atualizada = await prisma.notaFiscal.update({
    where: { id: nota.id },
    data: {
      status: patch.status === STATUS.CANCELADA ? STATUS.CANCELADA : patch.status || STATUS.PROCESSANDO,
      motivoRejeicao: patch.motivoRejeicao ?? undefined,
      payloadResposta: patch.payloadResposta ?? undefined,
      canceladaEm: patch.status === STATUS.CANCELADA ? new Date() : undefined,
    },
  });
  if (audit) {
    await audit({
      tipo: "NFE_CANCELADA",
      entidade: "NotaFiscal",
      entidadeId: atualizada.id,
      vendaId,
      payload: { justificativa: justificativaTrim, status: atualizada.status },
    });
  }
  return atualizada;
}

async function consultarNfe(prisma, { tenantId, vendaId, provider } = {}) {
  const nota = await prisma.notaFiscal.findFirst({
    where: { tenantId, vendaId },
    orderBy: { createdAt: "desc" },
  });
  if (!nota) {
    throw new AppError("Nenhuma NF-e nesta venda.", {
      code: "NFE_NAO_ENCONTRADA",
      httpStatus: 404,
    });
  }
  if (nota.status !== STATUS.PROCESSANDO) return nota;

  const emitente = await prisma.emitenteFiscal.findUnique({ where: { tenantId } });
  const sync = await sincronizarNotaSeProcessando(prisma, {
    nota,
    provider,
    emitente,
  });
  if (sync.kind === "ok") return sync.nota;
  if (sync.kind === "ausente") return nota;
  if (sync.kind === "incerto") {
    throw new AppError(
      "Não foi possível confirmar o status da NF-e no provedor. Tente consultar novamente em instantes.",
      { code: "NFE_STATUS_INCERTO", httpStatus: 503 },
    );
  }
  return nota;
}

async function aplicarWebhookNfe(prisma, { ref, body }) {
  if (!ref) {
    throw new AppError("Webhook sem referência da nota.", {
      code: "NFE_WEBHOOK_REF",
      httpStatus: 400,
    });
  }
  const nota = await prisma.notaFiscal.findFirst({
    where: { refProvedor: String(ref) },
  });
  if (!nota) {
    throw new AppError("Nota do webhook não encontrada.", {
      code: "NFE_NAO_ENCONTRADA",
      httpStatus: 404,
    });
  }
  const { mapStatusFocus } = require("../../domain/nfe/montarPayload");
  const status = mapStatusFocus(body?.status);
  return prisma.notaFiscal.update({
    where: { id: nota.id },
    data: {
      status,
      serie: body?.serie != null ? Number(body.serie) : undefined,
      numero: body?.numero != null ? Number(body.numero) : undefined,
      chaveAcesso: body?.chave_nfe || body?.chaveAcesso || undefined,
      protocolo: body?.protocolo_nfe || body?.protocolo || undefined,
      motivoRejeicao: body?.mensagem_sefaz || body?.motivoRejeicao || undefined,
      xmlUrl: body?.caminho_xml_nota_fiscal || body?.xmlUrl || undefined,
      danfeUrl: body?.caminho_danfe || body?.danfeUrl || undefined,
      payloadResposta: body,
      autorizadaEm: status === STATUS.AUTORIZADA ? new Date() : undefined,
      canceladaEm: status === STATUS.CANCELADA ? new Date() : undefined,
    },
  });
}

module.exports = {
  cancelarNfe,
  consultarNfe,
  aplicarWebhookNfe,
  sincronizarNotaSeProcessando,
};
