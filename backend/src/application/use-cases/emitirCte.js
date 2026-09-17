const { AppError } = require("../../shared/errors/appError");
const { STATUS } = require("../../domain/cte/constants");
const { aplicarRespostaProvedorCte } = require("../../domain/cte/aplicarResposta");
const {
  montarPayloadFocusCte,
  validarPreEmissaoCte,
} = require("../../domain/cte/montarPayload");
const {
  refCteTentativa,
  isErroInconclusivoCte,
} = require("../../domain/cte/refCte");
const { createCteProvider } = require("../../infra/cte/provider");
const { sincronizarCteSeProcessando } = require("./gerirCte");
const { onlyDigits } = require("../../domain/nfe/constants");
const { randomUUID } = require("node:crypto");

async function emitirCte(prisma, { tenantId, input = {}, provider, audit } = {}) {
  const emitente = await prisma.emitenteFiscal.findUnique({ where: { tenantId } });
  const validacao = validarPreEmissaoCte({ emitente, input });
  if (!validacao.ok) {
    throw new AppError(validacao.erros.join(" "), {
      code: "CTE_CADASTRO_INCOMPLETO",
      httpStatus: 400,
      details: { erros: validacao.erros },
    });
  }

  const cteProvider = provider || createCteProvider({ emitente });

  if (input.freteMovimentoId) {
    const existente = await prisma.conhecimentoTransporte.findFirst({
      where: {
        tenantId,
        freteMovimentoId: input.freteMovimentoId,
        status: { in: [STATUS.PROCESSANDO, STATUS.AUTORIZADA] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existente?.status === STATUS.AUTORIZADA) {
      throw new AppError("Já existe CT-e autorizado para este frete.", {
        code: "CTE_JA_EXISTE",
        httpStatus: 409,
      });
    }
    if (existente?.status === STATUS.PROCESSANDO) {
      const sync = await sincronizarCteSeProcessando(prisma, {
        doc: existente,
        provider: cteProvider,
        emitente,
      });
      if (sync.kind === "ok") {
        if (
          sync.doc.status === STATUS.AUTORIZADA ||
          sync.doc.status === STATUS.PROCESSANDO
        ) {
          return sync.doc;
        }
      } else if (sync.kind === "incerto") {
        throw new AppError(
          "A emissão anterior pode ter sido aceita. Consulte antes de reemitir.",
          { code: "CTE_STATUS_INCERTO", httpStatus: 503 },
        );
      } else if (sync.kind === "ausente") {
        // reutiliza o mesmo registro abaixo via frete count
      }
    }
  }

  const provisionalRef = `cte-${tenantId}-prov-${randomUUID()}`;
  const rascunho = await prisma.conhecimentoTransporte.create({
    data: {
      tenantId,
      status: STATUS.RASCUNHO,
      ambiente: emitente.ambiente || "homologacao",
      refProvedor: provisionalRef,
      emitenteNome: emitente.razaoSocial,
      emitenteDoc: onlyDigits(emitente.cnpj),
      remetenteNome: input.remetenteNome,
      remetenteDoc: onlyDigits(input.remetenteDoc),
      destinatarioNome: input.destinatarioNome,
      destinatarioDoc: onlyDigits(input.destinatarioDoc),
      tomadorNome: input.tomadorNome || null,
      tomadorDoc: onlyDigits(input.tomadorDoc) || null,
      origemMunicipio: input.origemMunicipio,
      origemUf: input.origemUf,
      origemCodigoMunicipio: input.origemCodigoMunicipio || null,
      destinoMunicipio: input.destinoMunicipio,
      destinoUf: input.destinoUf,
      destinoCodigoMunicipio: input.destinoCodigoMunicipio || null,
      valorServico: input.valorServico != null ? Number(input.valorServico) : null,
      valorCarga: input.valorCarga != null ? Number(input.valorCarga) : null,
      pesoKg: input.pesoKg != null ? Number(input.pesoKg) : null,
      observacoes: input.observacoes || null,
      vendaId: input.vendaId || null,
      freteMovimentoId: input.freteMovimentoId || null,
      ordemCarregamentoId: input.ordemCarregamentoId || null,
      motoristaId: input.motoristaId || null,
    },
  });

  let tentativa = 1;
  if (input.freteMovimentoId) {
    tentativa = await prisma.conhecimentoTransporte.count({
      where: { tenantId, freteMovimentoId: input.freteMovimentoId },
    });
  }
  const ref = refCteTentativa({
    tenantId,
    freteMovimentoId: input.freteMovimentoId,
    docId: rascunho.id,
    tentativa,
  });

  const payload = montarPayloadFocusCte({ emitente, input });
  await prisma.conhecimentoTransporte.update({
    where: { id: rascunho.id },
    data: {
      refProvedor: ref,
      status: STATUS.PROCESSANDO,
      emitidaEm: new Date(),
      payloadEnviado: payload,
    },
  });

  try {
    const resposta = await cteProvider.emitir({ ref, payload });
    const patch = aplicarRespostaProvedorCte(resposta);
    const atualizado = await prisma.conhecimentoTransporte.update({
      where: { id: rascunho.id },
      data: {
        status: patch.status || STATUS.PROCESSANDO,
        serie: patch.serie,
        numero: patch.numero,
        chaveAcesso: patch.chaveAcesso,
        protocolo: patch.protocolo,
        motivoRejeicao: patch.motivoRejeicao,
        xmlUrl: patch.xmlUrl,
        dacteUrl: patch.dacteUrl,
        payloadResposta: patch.payloadResposta,
        autorizadaEm: patch.autorizadaEm,
        canceladaEm: patch.canceladaEm,
        erroTecnico: null,
      },
    });
    if (audit) {
      await audit({
        tipo: "CTE_EMITIDO",
        entidade: "ConhecimentoTransporte",
        entidadeId: atualizado.id,
        vendaId: atualizado.vendaId || undefined,
        payload: { status: atualizado.status, ref },
      });
    }
    return atualizado;
  } catch (err) {
    if (isErroInconclusivoCte(err)) {
      await prisma.conhecimentoTransporte.update({
        where: { id: rascunho.id },
        data: {
          status: STATUS.PROCESSANDO,
          erroTecnico: String(err.message || "status incerto"),
        },
      });
      throw new AppError(
        "A emissão pode ter sido aceita pelo provedor. Consulte o status antes de emitir de novo.",
        { code: "CTE_STATUS_INCERTO", httpStatus: 503 },
      );
    }
    const patchStatus =
      err.code === "CTE_PROVEDOR_ERRO" ? STATUS.REJEITADA : STATUS.INDISPONIVEL;
    await prisma.conhecimentoTransporte.update({
      where: { id: rascunho.id },
      data: {
        status: patchStatus,
        motivoRejeicao: String(err.message || "erro"),
        erroTecnico: String(err.message || "erro"),
        payloadResposta: err.details || null,
      },
    });
    throw err;
  }
}

module.exports = { emitirCte };
