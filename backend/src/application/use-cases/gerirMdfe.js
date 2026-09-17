const { AppError } = require("../../shared/errors/appError");
const {
  STATUS,
  mapStatusFocus,
  statusPermiteEncerramento,
} = require("../../domain/mdfe/constants");
const { aplicarRespostaProvedorMdfe } = require("../../domain/mdfe/montarPayload");
const { createMdfeProvider } = require("../../infra/mdfe/provider");
const {
  isErroInconclusivoMdfe,
  isMdfeNaoEncontradoNoProvedor,
} = require("../../domain/mdfe/refMdfe");

async function sincronizarMdfeSeProcessando(prisma, { doc, provider, emitente } = {}) {
  if (!doc || doc.status !== STATUS.PROCESSANDO) {
    return { kind: "skip", doc };
  }
  const mdfeProvider = provider || createMdfeProvider({ emitente });
  try {
    const resposta = await mdfeProvider.consultar({ ref: doc.refProvedor });
    const patch = aplicarRespostaProvedorMdfe(resposta);
    const atualizado = await prisma.manifestoEletronico.update({
      where: { id: doc.id },
      data: {
        status: patch.status || doc.status,
        serie: patch.serie ?? undefined,
        numero: patch.numero ?? undefined,
        chaveAcesso: patch.chaveAcesso ?? undefined,
        protocolo: patch.protocolo ?? undefined,
        motivoRejeicao: patch.motivoRejeicao ?? undefined,
        xmlUrl: patch.xmlUrl ?? undefined,
        damdfeUrl: patch.damdfeUrl ?? undefined,
        payloadResposta: patch.payloadResposta ?? undefined,
        autorizadaEm: patch.autorizadaEm ?? undefined,
        canceladaEm: patch.canceladaEm ?? undefined,
        encerradaEm: patch.encerradaEm ?? undefined,
      },
      include: { documentos: true },
    });
    return { kind: "ok", doc: atualizado };
  } catch (err) {
    if (isMdfeNaoEncontradoNoProvedor(err)) return { kind: "ausente", doc };
    if (isErroInconclusivoMdfe(err)) return { kind: "incerto", doc, err };
    throw err;
  }
}

async function consultarMdfe(prisma, { tenantId, id, provider } = {}) {
  const doc = await prisma.manifestoEletronico.findFirst({
    where: { id, tenantId },
    include: { documentos: true },
  });
  if (!doc) {
    throw new AppError("MDF-e não encontrado.", {
      code: "MDFE_NAO_ENCONTRADO",
      httpStatus: 404,
    });
  }
  if (doc.status !== STATUS.PROCESSANDO) return doc;
  const emitente = await prisma.emitenteFiscal.findUnique({ where: { tenantId } });
  const sync = await sincronizarMdfeSeProcessando(prisma, { doc, provider, emitente });
  if (sync.kind === "ok") return sync.doc;
  if (sync.kind === "ausente") return doc;
  if (sync.kind === "incerto") {
    throw new AppError(
      "Não foi possível confirmar o status do MDF-e. Tente novamente em instantes.",
      { code: "MDFE_STATUS_INCERTO", httpStatus: 503 },
    );
  }
  return doc;
}

async function cancelarMdfe(prisma, { tenantId, id, justificativa, provider, audit } = {}) {
  const justificativaTrim = String(justificativa || "").trim();
  if (justificativaTrim.length < 15) {
    throw new AppError("A justificativa do cancelamento deve ter ao menos 15 caracteres.", {
      code: "MDFE_JUSTIFICATIVA",
      httpStatus: 400,
    });
  }
  const doc = await prisma.manifestoEletronico.findFirst({
    where: { id, tenantId, status: STATUS.AUTORIZADA },
  });
  if (!doc) {
    throw new AppError("Não há MDF-e autorizado para cancelar.", {
      code: "MDFE_NAO_AUTORIZADO",
      httpStatus: 400,
    });
  }
  const emitente = await prisma.emitenteFiscal.findUnique({ where: { tenantId } });
  const mdfeProvider = provider || createMdfeProvider({ emitente });
  if (!mdfeProvider.supports?.cancelar) {
    throw new AppError("Cancelamento de MDF-e não suportado pelo provedor.", {
      code: "MDFE_NAO_IMPLEMENTADO",
      httpStatus: 501,
    });
  }
  const resposta = await mdfeProvider.cancelar({
    ref: doc.refProvedor,
    justificativa: justificativaTrim,
  });
  const patch = aplicarRespostaProvedorMdfe(resposta);
  const atualizado = await prisma.manifestoEletronico.update({
    where: { id: doc.id },
    data: {
      status:
        patch.status === STATUS.CANCELADA
          ? STATUS.CANCELADA
          : patch.status || STATUS.PROCESSANDO,
      motivoRejeicao: patch.motivoRejeicao ?? undefined,
      payloadResposta: patch.payloadResposta ?? undefined,
      canceladaEm: patch.status === STATUS.CANCELADA ? new Date() : undefined,
    },
    include: { documentos: true },
  });
  if (audit) {
    await audit({
      tipo: "MDFE_CANCELADO",
      entidade: "ManifestoEletronico",
      entidadeId: atualizado.id,
      payload: { justificativa: justificativaTrim, status: atualizado.status },
    });
  }
  return atualizado;
}

async function encerrarMdfe(
  prisma,
  { tenantId, id, data, siglaUf, nomeMunicipio, provider, audit } = {},
) {
  const doc = await prisma.manifestoEletronico.findFirst({
    where: { id, tenantId },
  });
  if (!doc) {
    throw new AppError("MDF-e não encontrado.", {
      code: "MDFE_NAO_ENCONTRADO",
      httpStatus: 404,
    });
  }
  if (!statusPermiteEncerramento(doc.status)) {
    throw new AppError("Somente MDF-e autorizado pode ser encerrado.", {
      code: "MDFE_ENCERRAMENTO_INVALIDO",
      httpStatus: 400,
    });
  }
  if (!data || !siglaUf || !nomeMunicipio) {
    throw new AppError("Informe data, UF e município de encerramento.", {
      code: "MDFE_ENCERRAMENTO_DADOS",
      httpStatus: 400,
    });
  }
  const emitente = await prisma.emitenteFiscal.findUnique({ where: { tenantId } });
  const mdfeProvider = provider || createMdfeProvider({ emitente });
  if (!mdfeProvider.supports?.encerrar) {
    throw new AppError("Encerramento de MDF-e não suportado pelo provedor.", {
      code: "MDFE_NAO_IMPLEMENTADO",
      httpStatus: 501,
    });
  }
  const resposta = await mdfeProvider.encerrar({
    ref: doc.refProvedor,
    data,
    sigla_uf: String(siglaUf).toUpperCase(),
    nome_municipio: String(nomeMunicipio),
  });
  const patch = aplicarRespostaProvedorMdfe(resposta);
  const atualizado = await prisma.manifestoEletronico.update({
    where: { id: doc.id },
    data: {
      status:
        patch.status === STATUS.ENCERRADA
          ? STATUS.ENCERRADA
          : patch.status || STATUS.PROCESSANDO,
      ufEncerramento: String(siglaUf).toUpperCase(),
      municipioEncerramento: String(nomeMunicipio),
      payloadResposta: patch.payloadResposta ?? undefined,
      encerradaEm: patch.status === STATUS.ENCERRADA ? new Date() : undefined,
    },
    include: { documentos: true },
  });
  if (audit) {
    await audit({
      tipo: "MDFE_ENCERRADO",
      entidade: "ManifestoEletronico",
      entidadeId: atualizado.id,
      payload: {
        status: atualizado.status,
        uf: siglaUf,
        municipio: nomeMunicipio,
      },
    });
  }
  return atualizado;
}

async function aplicarWebhookMdfe(prisma, { ref, body }) {
  if (!ref) {
    throw new AppError("Webhook sem referência do MDF-e.", {
      code: "MDFE_WEBHOOK_REF",
      httpStatus: 400,
    });
  }
  const doc = await prisma.manifestoEletronico.findFirst({
    where: { refProvedor: String(ref) },
  });
  if (!doc) {
    throw new AppError("MDF-e do webhook não encontrado.", {
      code: "MDFE_NAO_ENCONTRADO",
      httpStatus: 404,
    });
  }
  const status = mapStatusFocus(body?.status);
  return prisma.manifestoEletronico.update({
    where: { id: doc.id },
    data: {
      status,
      serie: body?.serie != null ? Number(body.serie) : undefined,
      numero: body?.numero != null ? Number(body.numero) : undefined,
      chaveAcesso: body?.chave_mdfe || body?.chaveAcesso || undefined,
      protocolo: body?.protocolo || undefined,
      motivoRejeicao: body?.mensagem_sefaz || undefined,
      xmlUrl: body?.caminho_xml || undefined,
      damdfeUrl: body?.caminho_damdfe || undefined,
      payloadResposta: body,
      autorizadaEm: status === STATUS.AUTORIZADA ? new Date() : undefined,
      canceladaEm: status === STATUS.CANCELADA ? new Date() : undefined,
      encerradaEm: status === STATUS.ENCERRADA ? new Date() : undefined,
    },
    include: { documentos: true },
  });
}

module.exports = {
  consultarMdfe,
  cancelarMdfe,
  encerrarMdfe,
  aplicarWebhookMdfe,
  sincronizarMdfeSeProcessando,
};
