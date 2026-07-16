const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createCheque,
  getNextNumeroOrdem,
  findChequeById,
  deleteChequeById,
} = require("../src/infra/prisma/repositories/chequeRepository");

function p2002(target) {
  const e = new Error("Unique constraint");
  e.code = "P2002";
  e.meta = { target };
  return e;
}

test("getNextNumeroOrdem: retorna max+1 e trata ausência", async () => {
  const db1 = { cheque: { aggregate: async () => ({ _max: { numeroOrdem: 5 } }) } };
  assert.equal(await getNextNumeroOrdem(db1, 1), 6);

  const db2 = { cheque: { aggregate: async () => ({ _max: { numeroOrdem: null } }) } };
  assert.equal(await getNextNumeroOrdem(db2, 1), 1);
});

test("createCheque: lança quando tenantId ausente", async () => {
  await assert.rejects(
    () => createCheque({}, { valor: 10 }),
    /tenantId obrigatório/,
  );
});

test("createCheque: usa numeroOrdem informado nas options", async () => {
  let recebido = null;
  const db = {
    cheque: {
      create: async ({ data }) => {
        recebido = data;
        return { id: 1, ...data };
      },
    },
  };
  const res = await createCheque(db, { tenantId: 3, valor: 100 }, { numeroOrdem: 42 });
  assert.equal(res.numeroOrdem, 42);
  assert.equal(recebido.tenantId, 3);
});

test("createCheque: calcula proximo numeroOrdem quando não informado", async () => {
  const db = {
    cheque: {
      aggregate: async () => ({ _max: { numeroOrdem: 7 } }),
      create: async ({ data }) => ({ id: 1, ...data }),
    },
  };
  const res = await createCheque(db, { tenantId: 3, valor: 100 });
  assert.equal(res.numeroOrdem, 8);
});

test("createCheque: reintenta ao colidir numeroOrdem (array e string)", async () => {
  let calls = 0;
  const db = {
    cheque: {
      create: async ({ data }) => {
        calls++;
        if (calls === 1) throw p2002(["numeroOrdem"]);
        if (calls === 2) throw p2002("Cheque_numeroOrdem_key");
        return { id: 9, ...data };
      },
    },
  };
  const res = await createCheque(db, { tenantId: 1, valor: 5 }, { numeroOrdem: 1 });
  assert.equal(calls, 3);
  assert.equal(res.numeroOrdem, 3);
});

test("createCheque: repassa erro que não é conflito de numeroOrdem", async () => {
  const db = {
    cheque: {
      create: async () => {
        throw p2002(["outraColuna"]);
      },
    },
  };
  await assert.rejects(
    () => createCheque(db, { tenantId: 1, valor: 5 }, { numeroOrdem: 1 }),
    (e) => e.code === "P2002",
  );
});

test("findChequeById e deleteChequeById delegam ao db", async () => {
  let whereFind = null;
  let whereDel = null;
  const db = {
    cheque: {
      findFirst: async (args) => {
        whereFind = args;
        return { id: 1 };
      },
      deleteMany: async (args) => {
        whereDel = args;
        return { count: 1 };
      },
    },
  };
  await findChequeById(db, 1, 2, { pagamento: true });
  assert.deepEqual(whereFind.where, { id: 1, tenantId: 2 });
  assert.deepEqual(whereFind.include, { pagamento: true });

  await findChequeById(db, 1, 2);
  const del = await deleteChequeById(db, 1, 2);
  assert.equal(del.count, 1);
  assert.deepEqual(whereDel.where, { id: 1, tenantId: 2 });
});
