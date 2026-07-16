const test = require("node:test");
const assert = require("node:assert/strict");
const {
  actorFromReq,
  mergeAuditIntoPayload,
  withAuditActor,
  resolveUsuarioExibicao,
  registrarEventoFinanceiro,
} = require("../src/services/financeiroEventos");

test("actorFromReq: sem authUser retorna nulos", () => {
  assert.deepEqual(actorFromReq({}), { userId: null, userLabel: null });
  assert.deepEqual(actorFromReq(null), { userId: null, userLabel: null });
});

test("actorFromReq: extrai id e nome", () => {
  assert.deepEqual(
    actorFromReq({ authUser: { id: 5, name: " Ana " } }),
    { userId: 5, userLabel: "Ana" },
  );
  assert.deepEqual(
    actorFromReq({ authUser: { id: 0, name: "" } }),
    { userId: null, userLabel: null },
  );
});

test("mergeAuditIntoPayload: injeta campos de auditoria", () => {
  assert.deepEqual(
    mergeAuditIntoPayload({ a: 1 }, { userId: 3, userLabel: "Ana" }),
    { a: 1, auditUserId: 3, auditBy: "Ana" },
  );
  assert.equal(mergeAuditIntoPayload(null, {}), null);
  assert.equal(mergeAuditIntoPayload([1, 2], {}), null);
});

test("withAuditActor: sem actor devolve data intacta", () => {
  const data = { tipo: "X" };
  assert.equal(withAuditActor(data, {}), data);
});

test("withAuditActor: mescla actor mantendo valores existentes", () => {
  const res = withAuditActor(
    { tipo: "X", userId: 9, payload: { k: 1 } },
    { userId: 3, userLabel: "Ana" },
  );
  assert.equal(res.userId, 9);
  assert.equal(res.userLabel, "Ana");
  assert.deepEqual(res.payload, { k: 1, auditUserId: 3, auditBy: "Ana" });
});

test("resolveUsuarioExibicao: prioriza nome do userById", () => {
  const userById = new Map([[7, { name: "João" }]]);
  assert.equal(resolveUsuarioExibicao({ userId: 7 }, userById), "João");
});

test("resolveUsuarioExibicao: usa userLabel não-email", () => {
  assert.equal(resolveUsuarioExibicao({ userLabel: "Maria" }), "Maria");
  assert.equal(resolveUsuarioExibicao({ userLabel: "a@b.com" }), null);
});

test("resolveUsuarioExibicao: cai no payload.auditBy", () => {
  assert.equal(
    resolveUsuarioExibicao({ payload: { auditBy: "Carlos" } }),
    "Carlos",
  );
  assert.equal(
    resolveUsuarioExibicao({ payload: { auditBy: "x@y.com" } }),
    null,
  );
  assert.equal(resolveUsuarioExibicao({}), null);
});

test("registrarEventoFinanceiro: lança sem tenantId", async () => {
  await assert.rejects(
    () => registrarEventoFinanceiro({}, { tipo: "X" }),
    /tenantId obrigatório/,
  );
});

test("registrarEventoFinanceiro: cria linha com actor", async () => {
  let created = null;
  const tx = {
    financeiroEvento: {
      create: async (args) => {
        created = args.data;
        return created;
      },
    },
  };
  await registrarEventoFinanceiro(tx, {
    tenantId: 1,
    tipo: "PAGAMENTO_CRIADO",
    entidade: "Pagamento",
    entidadeId: 10,
    valor: 100,
    auditActor: { userId: 2, userLabel: "Ana" },
    payload: { origem: "teste" },
  });
  assert.equal(created.tenantId, 1);
  assert.equal(created.userId, 2);
  assert.equal(created.userLabel, "Ana");
  assert.equal(created.payload.auditBy, "Ana");
  assert.equal(created.entidadeId, 10);
});
