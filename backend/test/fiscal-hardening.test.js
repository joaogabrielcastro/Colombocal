const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveFocusDownloadUrl } = require("../src/infra/nfe/focusDownloadUrl");
const { auditarSemFalhar } = require("../src/services/fiscal/auditoriaFiscal");
const {
  validarVinculosOperacionais,
  validarDocumentosMdfe,
} = require("../src/services/fiscal/validarVinculosTenant");
const { cteEmitirSchema } = require("../src/schemas/cte");
const { mdfeEmitirSchema } = require("../src/schemas/mdfe");

test("download Focus aceita apenas HTTPS na origem autorizada", () => {
  const base = "https://homologacao.focusnfe.com.br";
  assert.equal(
    resolveFocusDownloadUrl("/arquivos/nota.xml", base),
    "https://homologacao.focusnfe.com.br/arquivos/nota.xml",
  );
  assert.throws(() => resolveFocusDownloadUrl("http://127.0.0.1/admin", base));
  assert.throws(() => resolveFocusDownloadUrl("https://atacante.test/coleta", base));
  assert.throws(() => resolveFocusDownloadUrl("//169.254.169.254/metadata", base));
});

test("schemas de CT-e e MDF-e exigem empresa emissora", () => {
  assert.equal(cteEmitirSchema.safeParse({}).success, false);
  assert.equal(mdfeEmitirSchema.safeParse({}).success, false);
});

test("vÃ­nculo operacional de outro tenant Ã© rejeitado", async () => {
  const prisma = {
    venda: { findFirst: async () => null },
    freteMovimento: { findFirst: async () => null },
    ordemCarregamento: { findFirst: async () => null },
    motorista: { findFirst: async () => null },
  };
  await assert.rejects(
    () => validarVinculosOperacionais(prisma, { tenantId: 1, input: { vendaId: 99 } }),
    (error) => error.code === "FISCAL_VINCULO_TENANT_INVALIDO",
  );
});

test("documento de MDF-e exige tenant e chave correspondentes", async () => {
  const prisma = { notaFiscal: { findFirst: async () => null } };
  await assert.rejects(
    () => validarDocumentosMdfe(prisma, {
      tenantId: 1,
      documentos: [{ tipo: "nfe", documentoId: 7, chaveAcesso: "1".repeat(44) }],
    }),
    (error) => error.code === "MDFE_DOCUMENTO_TENANT_INVALIDO",
  );
});

test("falha secundÃ¡ria de auditoria nÃ£o transforma emissÃ£o autorizada em erro", async () => {
  await assert.doesNotReject(() =>
    auditarSemFalhar(async () => {
      throw new Error("banco de auditoria indisponÃ­vel");
    }, { tipo: "NFE_EMITIDA", entidade: "NotaFiscal", entidadeId: 1 }),
  );
});
