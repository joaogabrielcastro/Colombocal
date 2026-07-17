const test = require("node:test");
const assert = require("node:assert/strict");
const {
  agent,
  prisma,
  resetDb,
  seedTenant,
  seedVendedor,
  seedProduto,
  seedCliente,
} = require("../helpers/testServer");

let ctx;
test.beforeEach(async () => {
  await resetDb();
  const tenant = await seedTenant();
  const vendedor = await seedVendedor(tenant.id);
  const cliente = await seedCliente(tenant.id, { vendedorId: vendedor.id });
  const produto = await seedProduto(tenant.id);
  const venda = await prisma.venda.create({
    data: {
      tenantId: tenant.id,
      numeroVenda: 1,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      valorTotal: 100,
    },
  });
  await prisma.tituloReceber.create({
    data: {
      tenantId: tenant.id,
      clienteId: cliente.id,
      vendaId: venda.id,
      numero: "VENDA-1",
      vencimento: new Date(),
      valorOriginal: 100,
      status: "aberto",
    },
  });
  ctx = { tenant, vendedor, cliente, produto, venda };
});

// ---- pagamentos ----
test("POST /api/pagamentos registra pagamento e baixa título", async () => {
  const res = await agent.post("/api/pagamentos").send({
    clienteId: ctx.cliente.id,
    vendaId: ctx.venda.id,
    tipo: "dinheiro",
    valor: 40,
  });
  assert.equal(res.status, 201);
  assert.equal(Number(res.body.valor), 40);
  const titulo = await prisma.tituloReceber.findFirst({ where: { vendaId: ctx.venda.id } });
  assert.equal(Number(titulo.valorPago), 40);
  assert.equal(titulo.status, "parcial");
});

test("POST /api/pagamentos com troco cria pagamento negativo", async () => {
  const res = await agent.post("/api/pagamentos").send({
    clienteId: ctx.cliente.id,
    vendaId: ctx.venda.id,
    tipo: "dinheiro",
    valor: 150,
    trocoTipo: "transferencia",
  });
  assert.equal(res.status, 201);
  const pagamentos = await prisma.pagamento.findMany({ where: { clienteId: ctx.cliente.id } });
  assert.equal(pagamentos.length, 2);
  assert.ok(pagamentos.some((p) => Number(p.valor) < 0));
});

test("POST /api/pagamentos tipo cheque é rejeitado", async () => {
  const res = await agent.post("/api/pagamentos").send({
    clienteId: ctx.cliente.id,
    tipo: "cheque",
    valor: 10,
  });
  assert.equal(res.status, 400);
});

test("POST /api/pagamentos cliente inexistente 404", async () => {
  const res = await agent.post("/api/pagamentos").send({
    clienteId: 9999,
    tipo: "dinheiro",
    valor: 10,
  });
  assert.equal(res.status, 404);
});

test("GET /api/pagamentos filtra por cliente e venda", async () => {
  await agent.post("/api/pagamentos").send({
    clienteId: ctx.cliente.id,
    vendaId: ctx.venda.id,
    tipo: "dinheiro",
    valor: 10,
  });
  const all = await agent.get("/api/pagamentos");
  assert.equal(all.status, 200);
  assert.ok(all.body.length >= 1);
  const porVenda = await agent.get("/api/pagamentos").query({ vendaId: ctx.venda.id, clienteId: ctx.cliente.id });
  assert.ok(porVenda.body.length >= 1);
});

test("DELETE /api/pagamentos/:id", async () => {
  const pg = await agent.post("/api/pagamentos").send({
    clienteId: ctx.cliente.id,
    vendaId: ctx.venda.id,
    tipo: "dinheiro",
    valor: 10,
  });
  const del = await agent.delete(`/api/pagamentos/${pg.body.id}`);
  assert.equal(del.status, 200);
  const missing = await agent.delete("/api/pagamentos/9999");
  assert.equal(missing.status, 404);
});

// ---- cheques ----
test("POST /api/cheques cria cheque e baixa título", async () => {
  const res = await agent.post("/api/cheques").send({
    clienteId: ctx.cliente.id,
    vendaId: ctx.venda.id,
    valor: 60,
    emitenteNome: "Fulano de Tal",
  });
  assert.equal(res.status, 201);
  const cheques = await prisma.cheque.findMany({ where: { clienteId: ctx.cliente.id } });
  assert.equal(cheques.length, 1);
  assert.equal(cheques[0].numeroOrdem, 1);
});

test("POST /api/cheques/lote cria vários cheques", async () => {
  const res = await agent.post("/api/cheques/lote").send({
    clienteId: ctx.cliente.id,
    vendaId: ctx.venda.id,
    itens: [
      { valor: 30, emitenteNome: "Emit A" },
      { valor: 40, emitenteNome: "Emit B" },
    ],
  });
  assert.equal(res.status, 201);
  const cheques = await prisma.cheque.findMany({ where: { clienteId: ctx.cliente.id } });
  assert.equal(cheques.length, 2);
});

test("GET /api/cheques lista, filtra e resumo", async () => {
  await agent.post("/api/cheques").send({
    clienteId: ctx.cliente.id,
    vendaId: ctx.venda.id,
    valor: 50,
    emitenteNome: "Emitente Teste",
    banco: "001",
    numero: "12345",
  });
  const list = await agent.get("/api/cheques");
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);

  const filtros = await agent.get("/api/cheques").query({
    clienteId: ctx.cliente.id,
    emitente: "Emitente",
    banco: "001",
    numero: "123",
    valorMin: "10",
    valorMax: "100",
    ordem: "1",
    cliente: "Cliente",
    dataInicio: "2000-01-01",
    dataFim: "2100-01-01",
  });
  assert.equal(filtros.status, 200);

  const comResumo = await agent.get("/api/cheques").query({ resumo: "1" });
  assert.equal(comResumo.status, 200);
  assert.equal(comResumo.body.resumo.count, 1);
  assert.equal(comResumo.body.resumo.total, 50);
});

test("GET /api/cheques/:id e DELETE", async () => {
  const c = await agent.post("/api/cheques").send({
    clienteId: ctx.cliente.id,
    vendaId: ctx.venda.id,
    valor: 50,
    emitenteNome: "Emitente XY",
  });
  const chequeId = (await prisma.cheque.findFirst({ where: { clienteId: ctx.cliente.id } })).id;
  const get = await agent.get(`/api/cheques/${chequeId}`);
  assert.equal(get.status, 200);
  assert.equal(get.body.id, chequeId);

  const missing = await agent.get("/api/cheques/9999");
  assert.equal(missing.status, 404);

  const del = await agent.delete(`/api/cheques/${chequeId}`);
  assert.equal(del.status, 200);
  const delMissing = await agent.delete("/api/cheques/9999");
  assert.equal(delMissing.status, 404);
});

// ---- recebimentos ----
test("POST /api/recebimentos compõe cheque + dinheiro + pix", async () => {
  const res = await agent.post("/api/recebimentos").send({
    clienteId: ctx.cliente.id,
    vendaId: ctx.venda.id,
    cheques: [{ valor: 30, emitenteNome: "Emit C" }],
    dinheiro: { valor: 40 },
    pix: { valor: 10 },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.totalGeral, 80);
  const cheques = await prisma.cheque.findMany({ where: { clienteId: ctx.cliente.id } });
  assert.equal(cheques.length, 1);
  assert.equal(cheques[0].vendaId, ctx.venda.id);

  const pagamentos = await prisma.pagamento.findMany({
    where: { vendaId: ctx.venda.id },
    orderBy: { id: "asc" },
  });
  assert.equal(pagamentos.length, 3);
  const tipos = pagamentos.map((p) => p.tipo).sort();
  assert.deepEqual(tipos, ["cheque", "dinheiro", "transferencia"]);
});

test("POST /api/recebimentos vazio é rejeitado", async () => {
  const res = await agent.post("/api/recebimentos").send({
    clienteId: ctx.cliente.id,
    vendaId: ctx.venda.id,
  });
  assert.equal(res.status, 400);
});
