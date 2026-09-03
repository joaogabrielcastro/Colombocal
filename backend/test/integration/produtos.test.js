const test = require("node:test");
const assert = require("node:assert/strict");
const { agent, prisma, resetDb, seedTenant } = require("../helpers/testServer");

test.beforeEach(async () => {
  await resetDb();
  await seedTenant();
});

test("GET /api/produtos lista vazia inicialmente", async () => {
  const res = await agent.get("/api/produtos");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
  assert.equal(res.headers["x-total-count"], "0");
});

test("POST /api/produtos cria produto e GET retorna", async () => {
  const created = await agent
    .post("/api/produtos")
    .send({ nome: "Cal Hidratada", codigo: "CH-1", precoPadrao: 120, unidade: "saco" });
  assert.equal(created.status, 201);
  assert.equal(created.body.nome, "Cal Hidratada");
  assert.equal(created.body.tenantId, 1);

  const list = await agent.get("/api/produtos");
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);

  const audit = await prisma.financeiroEvento.findFirst({
    where: { tipo: "PRODUTO_CRIADO", entidadeId: created.body.id },
  });
  assert.ok(audit);
  assert.equal(audit.entidade, "Produto");
});

test("POST /api/produtos gera código automático quando ausente", async () => {
  const created = await agent
    .post("/api/produtos")
    .send({ nome: "Sem Código", precoPadrao: 10 });
  assert.equal(created.status, 201);
  assert.match(created.body.codigo, /^AUTO-/);
  assert.equal(created.body.unidade, "ton");
});

test("POST /api/produtos rejeita código duplicado", async () => {
  await agent.post("/api/produtos").send({ nome: "A", codigo: "DUP", precoPadrao: 1 });
  const dup = await agent
    .post("/api/produtos")
    .send({ nome: "B", codigo: "DUP", precoPadrao: 1 });
  assert.equal(dup.status, 400);
  assert.match(dup.body.error, /Código já cadastrado/);
});

test("GET /api/produtos/:id 404 quando inexistente", async () => {
  const res = await agent.get("/api/produtos/999");
  assert.equal(res.status, 404);
});

test("GET /api/produtos/:id retorna produto com movimentações", async () => {
  const created = await agent
    .post("/api/produtos")
    .send({ nome: "Calcário", codigo: "CAL-1", precoPadrao: 90 });
  const res = await agent.get(`/api/produtos/${created.body.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.nome, "Calcário");
  assert.ok(Array.isArray(res.body.movimentacoes));
});

test("GET /api/produtos aplica filtros busca e ativo", async () => {
  await agent.post("/api/produtos").send({ nome: "Cal Virgem", codigo: "CV-1", precoPadrao: 5 });
  await agent.post("/api/produtos").send({ nome: "Areia", codigo: "AR-1", precoPadrao: 3 });

  const busca = await agent.get("/api/produtos?busca=cal");
  assert.equal(busca.status, 200);
  assert.equal(busca.body.length, 1);
  assert.equal(busca.body[0].nome, "Cal Virgem");

  const ativos = await agent.get("/api/produtos?ativo=true");
  assert.equal(ativos.status, 200);
  assert.equal(ativos.body.length, 2);

  const inativos = await agent.get("/api/produtos?ativo=false");
  assert.equal(inativos.status, 200);
  assert.equal(inativos.body.length, 0);
});

test("PUT /api/produtos/:id atualiza e 404 quando inexistente", async () => {
  const created = await agent
    .post("/api/produtos")
    .send({ nome: "Original", codigo: "ORI-1", precoPadrao: 10 });

  const upd = await agent
    .put(`/api/produtos/${created.body.id}`)
    .send({ nome: "Atualizado", precoPadrao: 20, unidade: "saco", ativo: true });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.nome, "Atualizado");
  assert.equal(Number(upd.body.precoPadrao), 20);

  const naoExiste = await agent
    .put("/api/produtos/9999")
    .send({ nome: "X" });
  assert.equal(naoExiste.status, 404);
});

test("DELETE /api/produtos/:id inativa e 404 quando inexistente", async () => {
  const created = await agent
    .post("/api/produtos")
    .send({ nome: "Para Remover", codigo: "REM-1", precoPadrao: 1 });

  const del = await agent.delete(`/api/produtos/${created.body.id}`);
  assert.equal(del.status, 200);
  assert.equal(del.body.success, true);

  const check = await prisma.produto.findUnique({ where: { id: created.body.id } });
  assert.equal(check.ativo, false);

  const naoExiste = await agent.delete("/api/produtos/9999");
  assert.equal(naoExiste.status, 404);
});

test("POST /api/produtos rejeita nome vazio e preço inválido", async () => {
  const semNome = await agent.post("/api/produtos").send({ precoPadrao: 10 });
  assert.equal(semNome.status, 400);
  const precoRuim = await agent
    .post("/api/produtos")
    .send({ nome: "X", precoPadrao: "abc" });
  assert.equal(precoRuim.status, 400);
});

test("PUT /api/produtos/:id reativa produto inativo", async () => {
  const created = await agent
    .post("/api/produtos")
    .send({ nome: "Inativo Temp", codigo: "INA-1", precoPadrao: 8 });
  await agent.delete(`/api/produtos/${created.body.id}`);

  const reativado = await agent
    .put(`/api/produtos/${created.body.id}`)
    .send({ nome: "Inativo Temp", codigo: "INA-1", precoPadrao: 8, unidade: "ton", ativo: true });
  assert.equal(reativado.status, 200);
  assert.equal(reativado.body.ativo, true);

  const naLista = await agent.get("/api/produtos").query({ ativo: "true" });
  assert.equal(naLista.status, 200);
  assert.ok(naLista.body.some((p) => p.id === created.body.id));
});
