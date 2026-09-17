const { AppError } = require("../../shared/errors/appError");
const { STATUS, mapStatusFocus } = require("../../domain/cte/constants");
const { aplicarRespostaProvedorCte } = require("../../domain/cte/aplicarResposta");
const { createCteProvider } = require("../../infra/cte/provider");
const {
  isErroInconclusivoCte,
  isCteNaoEncontradoNoProvedor,
} = require("../../domain/cte/refCte");

async function sincronizarCteSeProcessando(prisma, { doc, provider, emitente } = {}) {
  if (!doc || doc.status !== STATUS.PROCESSANDO) {
    return { kind: "skip", doc };
  }
  const cteProvider = provider || createCteProvider({ emitente });
  try {
    const resposta = await cteProvider.consultar({ ref: doc.refProvedor });
    const patch = aplicarRespostaProvedorCte(resposta);
    const atualizado = await prisma.conhecimentoTransporte.update({
      where: { id: doc.id },
      data: {
        status: patch.status || doc.status,
        serie: patch.serie ?? undefined,
        numero: patch.numero ?? undefined,
        chaveAcesso: patch.chaveAcesso ?? undefined,
        protocolo: patch.protocolo ?? undefined,
        motivoRejeicao: patch.motivoRejeicao ?? undefined,
        xmlUrl: patch.xmlUrl ?? undefined,
        dacteUrl: patch.dacteUrl ?? undefined,
        payloadResposta: patch.payloadResposta ?? undefined,
        autorizadaEm: patch.autorizadaEm ?? undefined,
        canceladaEm: patch.canceladaEm ?? undefined,
      },
    });
    return { kind: "ok", doc: atualizado };
  } catch (err) {
    if (isCteNaoEncontradoNoProvedor(err)) return { kind: "ausente", doc };
    if (isErroInconclusivoCte(err)) return { kind: "incerto", doc, err };
    throw err;
  }
}

async function consultarCte(prisma, { tenantId, id, provider } = {}) {
  const doc = await prisma.conhecimentoTransporte.findFirst({
    where: { id, tenantId },
  });
  if (!doc) {
    throw new AppError("CT-e não encontrado.", {
      code: "CTE_NAO_ENCONTRADO",
      httpStatus: 404,
    });
  }
  if (doc.status !== STATUS.PROCESSANDO) return doc;
  const emitente = await prisma.emitenteFiscal.findUnique({ where: { tenantId } });
  const sync = await sincronizarCteSeProcessando(prisma, { doc, provider, emitente });
  if (sync.kind === "ok") return sync.doc;
  if (sync.kind === "ausente") return doc;
  if (sync.kind === "incerto") {
    throw new AppError(
      "Não foi possível confirmar o status do CT-e. Tente novamente em instantes.",
      { code: "CTE_STATUS_INCERTO", httpStatus: 503 },
    );
  }
  return doc;
}

async function cancelarCte(prisma, { tenantId, id, justificativa, provider, audit } = {}) {
  const justificativaTrim = String(justificativa || "").trim();
  if (justificativaTrim.length < 15) {
    throw new AppError("A justificativa do cancelamento deve ter ao menos 15 caracteres.", {
      code: "CTE_JUSTIFICATIVA",
      httpStatus: 400,
    });
  }
  const doc = await prisma.conhecimentoTransporte.findFirst({
    where: { id, tenantId, status: STATUS.AUTORIZADA },
  });
  if (!doc) {
    throw new AppError("Não há CT-e autorizado para cancelar.", {
      code: "CTE_NAO_AUTORIZADO",
      httpStatus: 400,
    });
  }
  const emitente = await prisma.emitenteFiscal.findUnique({ where: { tenantId } });
  const cteProvider = provider || createCteProvider({ emitente });
  const resposta = await cteProvider.cancelar({
    ref: doc.refProvedor,
    justificativa: justificativaTrim,
  });
  const patch = aplicarRespostaProvedorCte(resposta);
  const atualizado = await prisma.conhecimentoTransporte.update({
    where: { id: doc.id },
    data: {
      status: patch.status === STATUS.CANCELADA ? STATUS.CANCELADA : patch.status || STATUS.PROCESSANDO,
      motivoRejeicao: patch.motivoRejeicao ?? undefined,
      payloadResposta: patch.payloadResposta ?? undefined,
      canceladaEm: patch.status === STATUS.CANCELADA ? new Date() : undefined,
    },
  });
  if (audit) {
    await audit({
      tipo: "CTE_CANCELADO",
      entidade: "ConhecimentoTransporte",
      entidadeId: atualizado.id,
      vendaId: atualizado.vendaId || undefined,
      payload: { justificativa: justificativaTrim, status: atualizado.status },
    });
  }
  return atualizado;
}

async function aplicarWebhookCte(prisma, { ref, body }) {
  if (!ref) {
    throw new AppError("Webhook sem referência do CT-e.", {
      code: "CTE_WEBHOOK_REF",
      httpStatus: 400,
    });
  }
  const doc = await prisma.conhecimentoTransporte.findFirst({
    where: { refProvedor: String(ref) },
  });
  if (!doc) {
    throw new AppError("CT-e do webhook não encontrado.", {
      code: "CTE_NAO_ENCONTRADO",
      httpStatus: 404,
    });
  }
  const status = mapStatusFocus(body?.status);
  return prisma.conhecimentoTransporte.update({
    where: { id: doc.id },
    data: {
      status,
      serie: body?.serie != null ? Number(body.serie) : undefined,
      numero: body?.numero != null ? Number(body.numero) : undefined,
      chaveAcesso: body?.chave_cte || body?.chaveAcesso || undefined,
      protocolo: body?.protocolo || undefined,
      motivoRejeicao: body?.mensagem_sefaz || body?.motivoRejeicao || undefined,
      xmlUrl: body?.caminho_xml || body?.xmlUrl || undefined,
      dacteUrl: body?.caminho_dacte || body?.dacteUrl || undefined,
      payloadResposta: body,
      autorizadaEm: status === STATUS.AUTORIZADA ? new Date() : undefined,
      canceladaEm: status === STATUS.CANCELADA ? new Date() : undefined,
    },
  });
}

module.exports = {
  consultarCte,
  cancelarCte,
  aplicarWebhookCte,
  sincronizarCteSeProcessando,
};
