const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { onNfeAutorizada } = require("../src/domain/nfe/onNfeAutorizada");
const { STATUS } = require("../src/domain/nfe/constants");
const {
  idempotencyKeyForTitulo,
  ensureCobrancaParaTitulo,
} = require("../src/application/use-cases/cobrancaBancaria");

describe("onNfeAutorizada", () => {
  it("ignora se status não é autorizada", async () => {
    const r = await onNfeAutorizada({}, {
      tenantId: 1,
      vendaId: 1,
      statusAnterior: STATUS.PROCESSANDO,
      statusNovo: STATUS.REJEITADA,
    });
    assert.equal(r.skipped, true);
  });

  it("ignora se já estava autorizada", async () => {
    const r = await onNfeAutorizada({}, {
      tenantId: 1,
      vendaId: 1,
      statusAnterior: STATUS.AUTORIZADA,
      statusNovo: STATUS.AUTORIZADA,
    });
    assert.equal(r.skipped, true);
    assert.equal(r.reason, "JA_AUTORIZADA");
  });
});

describe("idempotencyKeyForTitulo", () => {
  it("é determinística", () => {
    assert.equal(idempotencyKeyForTitulo(99), "cobranca:titulo:99");
  });
});

describe("ensureCobrancaParaTitulo concorrência", () => {
  it("segunda create com P2002 retorna existente", async () => {
    let creates = 0;
    const existing = { id: 1, tituloId: 10, status: "PENDENTE" };
    const prisma = {
      cobrancaBancaria: {
        findUnique: async () => (creates > 0 ? existing : null),
        create: async () => {
          creates += 1;
          if (creates === 1) {
            const err = new Error("unique");
            err.code = "P2002";
            throw err;
          }
          return existing;
        },
      },
      configuracaoBancaria: {
        findUnique: async () => null,
      },
    };
    // Primeira findUnique null; create P2002; segunda findUnique existing
    let findCalls = 0;
    prisma.cobrancaBancaria.findUnique = async () => {
      findCalls += 1;
      return findCalls === 1 ? null : existing;
    };
    const r = await ensureCobrancaParaTitulo(prisma, {
      tenantId: 1,
      titulo: {
        id: 10,
        clienteId: 2,
        vendaId: 3,
        valorOriginal: 100,
        vencimento: new Date(),
      },
      banco: "BRADESCO",
    });
    assert.equal(r.id, 1);
  });
});
