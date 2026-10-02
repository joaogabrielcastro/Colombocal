const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buscarEmitenteFiscal,
  definirEmitentePadrao,
} = require("../src/services/emitenteFiscal");

test("buscarEmitenteFiscal isola tenant, recurso e id escolhido", async () => {
  let recebido;
  const prisma = {
    emitenteFiscal: {
      findFirst: async (args) => {
        recebido = args;
        return { id: 22, tenantId: 7, habilitaNfe: true };
      },
    },
  };
  const row = await buscarEmitenteFiscal(prisma, {
    tenantId: 7,
    emitenteFiscalId: 22,
    recurso: "nfe",
    obrigatorio: true,
  });
  assert.equal(row.id, 22);
  assert.deepEqual(recebido.where, {
    tenantId: 7,
    ativo: true,
    habilitaNfe: true,
    id: 22,
  });
});

test("buscarEmitenteFiscal usa padrão ativo quando id não é informado", async () => {
  let recebido;
  const prisma = {
    emitenteFiscal: {
      findMany: async (args) => {
        recebido = args;
        return [{ id: 3, padrao: true }];
      },
    },
  };
  await buscarEmitenteFiscal(prisma, { tenantId: 2, recurso: "mdfe" });
  assert.deepEqual(recebido.where, {
    tenantId: 2,
    ativo: true,
    habilitaMdfe: true,
  });
  assert.deepEqual(recebido.orderBy, [{ padrao: "desc" }, { id: "asc" }]);
  assert.equal(recebido.take, 2);
});

test("buscarEmitenteFiscal exige seleÃ§Ã£o quando hÃ¡ mÃºltiplas empresas sem padrÃ£o", async () => {
  const prisma = {
    emitenteFiscal: {
      findMany: async () => [{ id: 3, padrao: false }, { id: 4, padrao: false }],
    },
  };
  await assert.rejects(
    buscarEmitenteFiscal(prisma, { tenantId: 2, recurso: "nfe", obrigatorio: true }),
    (err) => err.code === "EMITENTE_FISCAL_SELECAO_OBRIGATORIA",
  );
});

test("buscarEmitenteFiscal rejeita emitente de outro tenant ou desabilitado", async () => {
  const prisma = { emitenteFiscal: { findFirst: async () => null } };
  await assert.rejects(
    buscarEmitenteFiscal(prisma, {
      tenantId: 1,
      emitenteFiscalId: 99,
      recurso: "nfe",
      obrigatorio: true,
    }),
    (err) => err.code === "EMITENTE_FISCAL_INVALIDO" && err.httpStatus === 400,
  );
});

test("definirEmitentePadrao limpa o anterior dentro de transação", async () => {
  const chamadas = [];
  const tx = {
    emitenteFiscal: {
      findFirst: async ({ where }) => ({ id: where.id, tenantId: where.tenantId }),
      updateMany: async (args) => chamadas.push(["updateMany", args]),
      update: async (args) => {
        chamadas.push(["update", args]);
        return { id: args.where.id, padrao: true };
      },
    },
  };
  const prisma = { $transaction: (fn) => fn(tx) };
  const row = await definirEmitentePadrao(prisma, {
    tenantId: 4,
    emitenteFiscalId: 8,
  });
  assert.equal(row.padrao, true);
  assert.deepEqual(chamadas[0][1].where, { tenantId: 4 });
  assert.deepEqual(chamadas[1][1], { where: { id: 8 }, data: { padrao: true } });
});
