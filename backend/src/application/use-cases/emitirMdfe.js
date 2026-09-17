const { randomUUID } = require("node:crypto");
const { AppError } = require("../../shared/errors/appError");
const { STATUS } = require("../../domain/mdfe/constants");
const {
  montarPayloadFocusMdfe,
  aplicarRespostaProvedorMdfe,
  validarPreEmissaoMdfe,
} = require("../../domain/mdfe/montarPayload");
const {
  refMdfeTentativa,
  isErroInconclusivoMdfe,
} = require("../../domain/mdfe/refMdfe");
const { createMdfeProvider } = require("../../infra/mdfe/provider");

async function emitirMdfe(prisma, { tenantId, input = {}, provider, audit } = {}) {
  const emitente = await prisma.emitenteFiscal.findUnique({ where: { tenantId } });
  const documentos = Array.isArray(input.documentos) ? input.documentos : [];
  const validacao = validarPreEmissaoMdfe({ emitente, input, documentos });
  if (!validacao.ok) {
    throw new AppError(validacao.erros.join(" "), {
      code: "MDFE_CADASTRO_INCOMPLETO",
      httpStatus: 400,
      details: { erros: validacao.erros },
    });
  }

  const mdfeProvider = provider || createMdfeProvider({ emitente });
  const provisionalRef = `mdfe-${tenantId}-prov-${randomUUID()}`;

  const rascunho = await prisma.manifestoEletronico.create({
    data: {
      tenantId,
      status: STATUS.RASCUNHO,
      ambiente: emitente?.ambiente || "homologacao",
      refProvedor: provisionalRef,
      ufInicio: input.ufInicio,
      ufFim: input.ufFim,
      veiculoPlaca: input.veiculoPlaca,
      veiculoDescricao: input.veiculoDescricao || null,
      motoristaNome: input.motoristaNome || null,
      motoristaDoc: input.motoristaDoc || null,
      vendaId: input.vendaId || null,
      freteMovimentoId: input.freteMovimentoId || null,
      ordemCarregamentoId: input.ordemCarregamentoId || null,
      motoristaId: input.motoristaId || null,
      documentos: {
        create: documentos.map((d) => ({
          tenantId,
          tipo: d.tipo === "cte" ? "cte" : "nfe",
          documentoId: d.documentoId || null,
          chaveAcesso: String(d.chaveAcesso),
        })),
      },
    },
    include: { documentos: true },
  });

  const ref = refMdfeTentativa({
    tenantId,
    docId: rascunho.id,
    tentativa: 1,
  });
  const payload = montarPayloadFocusMdfe({
    emitente,
    input,
    documentos: rascunho.documentos,
  });

  await prisma.manifestoEletronico.update({
    where: { id: rascunho.id },
    data: {
      refProvedor: ref,
      status: STATUS.PROCESSANDO,
      emitidaEm: new Date(),
      payloadEnviado: payload,
    },
  });

  try {
    const resposta = await mdfeProvider.emitir({ ref, payload });
    const patch = aplicarRespostaProvedorMdfe(resposta);
    const atualizado = await prisma.manifestoEletronico.update({
      where: { id: rascunho.id },
      data: {
        status: patch.status || STATUS.PROCESSANDO,
        serie: patch.serie,
        numero: patch.numero,
        chaveAcesso: patch.chaveAcesso,
        protocolo: patch.protocolo,
        motivoRejeicao: patch.motivoRejeicao,
        xmlUrl: patch.xmlUrl,
        damdfeUrl: patch.damdfeUrl,
        payloadResposta: patch.payloadResposta,
        autorizadaEm: patch.autorizadaEm,
        canceladaEm: patch.canceladaEm,
        encerradaEm: patch.encerradaEm,
        erroTecnico: null,
      },
      include: { documentos: true },
    });
    if (audit) {
      await audit({
        tipo: "MDFE_EMITIDO",
        entidade: "ManifestoEletronico",
        entidadeId: atualizado.id,
        vendaId: atualizado.vendaId || undefined,
        payload: { status: atualizado.status, ref },
      });
    }
    return atualizado;
  } catch (err) {
    if (isErroInconclusivoMdfe(err)) {
      await prisma.manifestoEletronico.update({
        where: { id: rascunho.id },
        data: {
          status: STATUS.PROCESSANDO,
          erroTecnico: String(err.message || "status incerto"),
        },
      });
      throw new AppError(
        "A emissão pode ter sido aceita pelo provedor. Consulte antes de reemitir.",
        { code: "MDFE_STATUS_INCERTO", httpStatus: 503 },
      );
    }
    await prisma.manifestoEletronico.update({
      where: { id: rascunho.id },
      data: {
        status:
          err.code === "MDFE_PROVEDOR_ERRO" ? STATUS.REJEITADA : STATUS.INDISPONIVEL,
        motivoRejeicao: String(err.message || "erro"),
        erroTecnico: String(err.message || "erro"),
        payloadResposta: err.details || null,
      },
    });
    throw err;
  }
}

module.exports = { emitirMdfe };
