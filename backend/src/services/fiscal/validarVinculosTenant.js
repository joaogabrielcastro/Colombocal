const { AppError } = require("../../shared/errors/appError");

const VINCULOS = [
  ["vendaId", "venda", "Venda"],
  ["freteMovimentoId", "freteMovimento", "Frete"],
  ["ordemCarregamentoId", "ordemCarregamento", "Ordem de carregamento"],
  ["motoristaId", "motorista", "Motorista"],
];

async function validarVinculosOperacionais(prisma, { tenantId, input = {} } = {}) {
  await Promise.all(
    VINCULOS.map(async ([campo, delegate, label]) => {
      const id = input[campo];
      if (id == null) return;
      const row = await prisma[delegate].findFirst({
        where: { id: Number(id), tenantId },
        select: { id: true },
      });
      if (!row) {
        throw new AppError(`${label} nÃ£o pertence a este tenant.`, {
          code: "FISCAL_VINCULO_TENANT_INVALIDO",
          httpStatus: 400,
          details: { campo, id: Number(id) },
        });
      }
    }),
  );
}

async function validarDocumentosMdfe(prisma, { tenantId, documentos = [] } = {}) {
  await Promise.all(
    documentos.map(async (doc) => {
      if (doc.documentoId == null) return;
      const delegate = doc.tipo === "cte" ? "conhecimentoTransporte" : "notaFiscal";
      const row = await prisma[delegate].findFirst({
        where: {
          id: Number(doc.documentoId),
          tenantId,
          chaveAcesso: String(doc.chaveAcesso),
        },
        select: { id: true },
      });
      if (!row) {
        throw new AppError("Documento fiscal do MDF-e nÃ£o pertence ao tenant ou a chave diverge.", {
          code: "MDFE_DOCUMENTO_TENANT_INVALIDO",
          httpStatus: 400,
          details: { tipo: doc.tipo, documentoId: Number(doc.documentoId) },
        });
      }
    }),
  );
}

module.exports = { validarVinculosOperacionais, validarDocumentosMdfe };
