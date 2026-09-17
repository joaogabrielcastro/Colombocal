const { randomUUID } = require("node:crypto");
const { AppError } = require("../../shared/errors/appError");
const {
  STATUS,
  refCiotTentativa,
  validarRegistroCiot,
} = require("../../domain/ciot/constants");
const { createCiotProvider } = require("../../infra/ciot/provider");

async function registrarCiot(prisma, { tenantId, input = {}, provider, audit } = {}) {
  const validacao = validarRegistroCiot(input);
  if (!validacao.ok) {
    throw new AppError(validacao.erros.join(" "), {
      code: "CIOT_VALIDACAO",
      httpStatus: 400,
      details: { erros: validacao.erros },
    });
  }

  const ciotProvider = provider || createCiotProvider();
  const provisionalRef = `ciot-${tenantId}-prov-${randomUUID()}`;

  const rascunho = await prisma.operacaoCiot.create({
    data: {
      tenantId,
      status: STATUS.RASCUNHO,
      refProvedor: provisionalRef,
      provider: ciotProvider.name,
      tipoOperacao: input.tipoOperacao || null,
      transportadorNome: input.transportadorNome,
      transportadorDoc: input.transportadorDoc || null,
      contratanteNome: input.contratanteNome,
      contratanteDoc: input.contratanteDoc || null,
      motoristaId: input.motoristaId || null,
      motoristaNome: input.motoristaNome || null,
      veiculoPlaca: input.veiculoPlaca || null,
      veiculoDescricao: input.veiculoDescricao || null,
      origemMunicipio: input.origemMunicipio,
      origemUf: input.origemUf,
      destinoMunicipio: input.destinoMunicipio,
      destinoUf: input.destinoUf,
      valorOperacao: Number(input.valorOperacao),
      observacoes: input.observacoes || null,
      freteMovimentoId: input.freteMovimentoId || null,
      vendaId: input.vendaId || null,
      dataOperacao: input.dataOperacao ? new Date(input.dataOperacao) : new Date(),
    },
  });

  let tentativa = 1;
  if (input.freteMovimentoId) {
    tentativa = await prisma.operacaoCiot.count({
      where: { tenantId, freteMovimentoId: input.freteMovimentoId },
    });
  }
  const ref = refCiotTentativa({
    tenantId,
    docId: rascunho.id,
    freteMovimentoId: input.freteMovimentoId,
    tentativa,
  });

  await prisma.operacaoCiot.update({
    where: { id: rascunho.id },
    data: {
      refProvedor: ref,
      status: STATUS.PROCESSANDO,
      payloadEnviado: input,
    },
  });

  try {
    const resposta = await ciotProvider.registrar({ ref, payload: input });
    const atualizado = await prisma.operacaoCiot.update({
      where: { id: rascunho.id },
      data: {
        status: resposta.status || STATUS.REGISTRADO,
        codigoCiot: resposta.codigoCiot || null,
        codigoVerificador: resposta.codigoVerificador || null,
        payloadResposta: resposta.raw || resposta,
        registradaEm: new Date(),
        erroTecnico: null,
      },
    });
    if (audit) {
      await audit({
        tipo: "CIOT_REGISTRADO",
        entidade: "OperacaoCiot",
        entidadeId: atualizado.id,
        vendaId: atualizado.vendaId || undefined,
        payload: {
          status: atualizado.status,
          codigoCiot: atualizado.codigoCiot,
          demonstracao: Boolean(resposta.demonstracao),
        },
      });
    }
    return atualizado;
  } catch (err) {
    if (err.code === "CIOT_NAO_IMPLEMENTADO") {
      await prisma.operacaoCiot.update({
        where: { id: rascunho.id },
        data: {
          status: STATUS.NAO_IMPLEMENTADO,
          erroTecnico: String(err.message),
        },
      });
    } else {
      await prisma.operacaoCiot.update({
        where: { id: rascunho.id },
        data: {
          status: STATUS.INDISPONIVEL,
          erroTecnico: String(err.message || "erro"),
        },
      });
    }
    throw err;
  }
}

async function consultarCiot(prisma, { tenantId, id, provider } = {}) {
  const doc = await prisma.operacaoCiot.findFirst({
    where: { id, tenantId },
  });
  if (!doc) {
    throw new AppError("CIOT não encontrado.", {
      code: "CIOT_NAO_ENCONTRADO",
      httpStatus: 404,
    });
  }
  if (doc.status !== STATUS.PROCESSANDO || !doc.refProvedor) return doc;
  const ciotProvider = provider || createCiotProvider();
  try {
    const resposta = await ciotProvider.consultar({ ref: doc.refProvedor });
    return prisma.operacaoCiot.update({
      where: { id: doc.id },
      data: {
        status: resposta.status || doc.status,
        codigoCiot: resposta.codigoCiot ?? doc.codigoCiot,
        codigoVerificador: resposta.codigoVerificador ?? doc.codigoVerificador,
        payloadResposta: resposta.raw || resposta,
      },
    });
  } catch (err) {
    if (err.code === "CIOT_NAO_IMPLEMENTADO") return doc;
    if (err.httpStatus === 404 || err.code === "CIOT_NAO_ENCONTRADO") return doc;
    throw err;
  }
}

async function cancelarCiot(prisma, { tenantId, id, provider, audit } = {}) {
  const doc = await prisma.operacaoCiot.findFirst({
    where: { id, tenantId, status: STATUS.REGISTRADO },
  });
  if (!doc) {
    throw new AppError("Não há CIOT registrado para cancelar.", {
      code: "CIOT_NAO_REGISTRADO",
      httpStatus: 400,
    });
  }
  const ciotProvider = provider || createCiotProvider();
  const resposta = await ciotProvider.cancelar({ ref: doc.refProvedor });
  const atualizado = await prisma.operacaoCiot.update({
    where: { id: doc.id },
    data: {
      status: STATUS.CANCELADO,
      payloadResposta: resposta.raw || resposta,
      canceladaEm: new Date(),
    },
  });
  if (audit) {
    await audit({
      tipo: "CIOT_CANCELADO",
      entidade: "OperacaoCiot",
      entidadeId: atualizado.id,
      payload: { status: atualizado.status },
    });
  }
  return atualizado;
}

module.exports = { registrarCiot, consultarCiot, cancelarCiot };
