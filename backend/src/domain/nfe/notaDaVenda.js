const { STATUS } = require("./constants");

async function notaBloqueanteDaVenda(prisma, { tenantId, vendaId }) {
  return prisma.notaFiscal.findFirst({
    where: {
      tenantId,
      vendaId,
      status: { in: [STATUS.PROCESSANDO, STATUS.AUTORIZADA] },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function ultimaNotaDaVenda(prisma, { tenantId, vendaId }) {
  return prisma.notaFiscal.findFirst({
    where: { tenantId, vendaId },
    orderBy: { createdAt: "desc" },
  });
}

function sanitizarNota(nota) {
  if (!nota) return null;
  return {
    id: nota.id,
    vendaId: nota.vendaId,
    status: nota.status,
    serie: nota.serie,
    numero: nota.numero,
    chaveAcesso: nota.chaveAcesso,
    protocolo: nota.protocolo,
    motivoRejeicao: nota.motivoRejeicao,
    refProvedor: nota.refProvedor,
    emitidaEm: nota.emitidaEm,
    autorizadaEm: nota.autorizadaEm,
    canceladaEm: nota.canceladaEm,
    createdAt: nota.createdAt,
    updatedAt: nota.updatedAt,
    temDanfe: !!(nota.danfeUrl || nota.status === STATUS.AUTORIZADA),
    temXml: !!(nota.xmlUrl || nota.status === STATUS.AUTORIZADA),
  };
}

module.exports = {
  notaBloqueanteDaVenda,
  ultimaNotaDaVenda,
  sanitizarNota,
};
