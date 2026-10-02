const { AppError } = require("../shared/errors/appError");

async function listarEmitentesFiscais(prisma, tenantId, { ativos = false } = {}) {
  return prisma.emitenteFiscal.findMany({
    where: { tenantId, ...(ativos ? { ativo: true } : {}) },
    orderBy: [{ padrao: "desc" }, { razaoSocial: "asc" }, { id: "asc" }],
  });
}

async function buscarEmitenteFiscal(
  prisma,
  { tenantId, emitenteFiscalId, recurso = "nfe", obrigatorio = false } = {},
) {
  const habilitacao = {
    nfe: "habilitaNfe",
    cte: "habilitaCte",
    mdfe: "habilitaMdfe",
  }[recurso];
  const where = {
    tenantId,
    ativo: true,
    ...(habilitacao ? { [habilitacao]: true } : {}),
  };
  let emitente = null;
  if (emitenteFiscalId != null) {
    emitente = await prisma.emitenteFiscal.findFirst({
      where: { ...where, id: Number(emitenteFiscalId) },
    });
    if (!emitente) {
      throw new AppError("Empresa emissora inválida ou não habilitada.", {
        code: "EMITENTE_FISCAL_INVALIDO",
        httpStatus: 400,
      });
    }
  } else {
    const candidatos = await prisma.emitenteFiscal.findMany({
      where,
      orderBy: [{ padrao: "desc" }, { id: "asc" }],
      take: 2,
    });
    const padrao = candidatos.find((item) => item.padrao);
    if (padrao) {
      emitente = padrao;
    } else if (candidatos.length === 1) {
      emitente = candidatos[0];
    } else if (candidatos.length > 1) {
      throw new AppError("Selecione explicitamente a empresa emissora.", {
        code: "EMITENTE_FISCAL_SELECAO_OBRIGATORIA",
        httpStatus: 400,
      });
    }
  }
  if (!emitente && obrigatorio) {
    throw new AppError("Nenhuma empresa emissora ativa e habilitada foi cadastrada.", {
      code: "EMITENTE_FISCAL_NAO_CONFIGURADO",
      httpStatus: 400,
    });
  }
  return emitente;
}

async function definirEmitentePadrao(prisma, { tenantId, emitenteFiscalId }) {
  return prisma.$transaction(async (tx) => {
    const emitente = await tx.emitenteFiscal.findFirst({
      where: { id: Number(emitenteFiscalId), tenantId, ativo: true },
    });
    if (!emitente) {
      throw new AppError("Empresa emissora não encontrada.", {
        code: "EMITENTE_FISCAL_NAO_ENCONTRADO",
        httpStatus: 404,
      });
    }
    await tx.emitenteFiscal.updateMany({ where: { tenantId }, data: { padrao: false } });
    return tx.emitenteFiscal.update({
      where: { id: emitente.id },
      data: { padrao: true },
    });
  });
}

module.exports = {
  listarEmitentesFiscais,
  buscarEmitenteFiscal,
  definirEmitentePadrao,
};
