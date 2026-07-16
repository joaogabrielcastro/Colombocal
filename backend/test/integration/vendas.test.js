const test = require("node:test");
const assert = require("node:assert/strict");
const {
  agent,
  prisma,
  resetDb,
  seedTenant,
  seedVendedor,
  seedMotorista,
  seedProduto,
  seedCliente,
} = require("../helpers/testServer");

let ctx;
test.beforeEach(async () => {
  await resetDb();
  const tenant = await seedTenant();
  const vendedor = await seedVendedor(tenant.id, { comissaoPercentual: 5 });
  const cliente = await seedCliente(tenant.id, { vendedorId: vendedor.id });
  const produtoTon = await seedProduto(tenant.id, {
    nome: "Cal Ton",
    unidade: "ton",
    precoPadrao: 100,
    codigo: "T1",
  });
  const produtoSaco = await seedProduto(tenant.id, {
    nome: "Cal Saco",
    unidade: "saco",
    precoPadrao: 20,
    codigo: "S1",
  });
  ctx = { tenant, vendedor, cliente, produtoTon, produtoSaco };
});

async function criarVenda(over = {}) {
  return agent.post("/api/vendas").send({
    clienteId: ctx.cliente.id,
    vendedorId: ctx.vendedor.id,
    itens: [{ produtoId: ctx.produtoTon.id, quantidade: 2, precoUnitario: 100 }],
    ...over,
  });
}

test("POST /api/vendas cria venda com comissão, título e movimentação", async () => {
  const res = await criarVenda();
  assert.equal(res.status, 201);
  assert.equal(Number(res.body.valorTotal), 200);
  assert.equal(res.body.numeroVenda, 1);
  assert.equal(Number(res.body.comissaoValor), 10); // 5% de 200
  assert.equal(res.body.itens.length, 1);

  const titulos = await prisma.tituloReceber.findMany({ where: { vendaId: res.body.id } });
  assert.equal(titulos.length, 1);
  assert.equal(Number(titulos[0].valorOriginal), 200);
  const mov = await prisma.movimentacaoEstoque.findMany({ where: { vendaId: res.body.id } });
  assert.equal(mov.length, 1);
  assert.equal(mov[0].tipo, "saida");
  const eventos = await prisma.financeiroEvento.findMany({ where: { vendaId: res.body.id } });
  assert.ok(eventos.some((e) => e.tipo === "VENDA_CRIADA"));
});

test("POST /api/vendas número incrementa por tenant", async () => {
  const v1 = await criarVenda();
  const v2 = await criarVenda();
  assert.equal(v1.body.numeroVenda, 1);
  assert.equal(v2.body.numeroVenda, 2);
});

test("POST /api/vendas calcula frete automático por tonelada", async () => {
  const res = await criarVenda({ fretePorTonelada: 10 });
  assert.equal(res.status, 201);
  assert.equal(Number(res.body.frete), 20); // 2 ton * 10
  const fretes = await prisma.freteMovimento.findMany({ where: { vendaId: res.body.id } });
  assert.equal(fretes.length, 1);
});

test("POST /api/vendas frete por saco", async () => {
  const res = await agent.post("/api/vendas").send({
    clienteId: ctx.cliente.id,
    vendedorId: ctx.vendedor.id,
    fretePorSaco: 1.5,
    itens: [{ produtoId: ctx.produtoSaco.id, quantidade: 10, precoUnitario: 20 }],
  });
  assert.equal(res.status, 201);
  assert.equal(Number(res.body.frete), 15); // 10 sacos * 1.5
});

test("POST /api/vendas produto inexistente retorna 400", async () => {
  const res = await criarVenda({
    itens: [{ produtoId: 99999, quantidade: 1, precoUnitario: 10 }],
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /não encontrado/);
});

test("POST /api/vendas cliente inexistente retorna 404", async () => {
  const res = await criarVenda({ clienteId: 99999 });
  assert.equal(res.status, 404);
});

test("POST /api/vendas vendedor inexistente retorna 404", async () => {
  const res = await criarVenda({ vendedorId: 99999 });
  assert.equal(res.status, 404);
});

test("POST /api/vendas motorista inexistente retorna 404", async () => {
  const res = await criarVenda({ motoristaId: 99999 });
  assert.equal(res.status, 404);
});

test("POST /api/vendas com motorista válido e atualizarCliente sincroniza preços/frete", async () => {
  const motorista = await seedMotorista(ctx.tenant.id);
  const res = await criarVenda({
    motoristaId: motorista.id,
    atualizarCliente: {
      precos: [{ produtoId: ctx.produtoTon.id, preco: 90 }],
      fretePadraoSaco: 3,
    },
  });
  assert.equal(res.status, 201);
  const cli = await prisma.cliente.findUnique({ where: { id: ctx.cliente.id } });
  assert.equal(Number(cli.fretePadraoSaco), 3);
  const preco = await prisma.precoClienteProduto.findFirst({
    where: { clienteId: ctx.cliente.id, produtoId: ctx.produtoTon.id },
  });
  assert.equal(Number(preco.preco), 90);
});

test("POST /api/vendas itens vazio retorna 400", async () => {
  const res = await criarVenda({ itens: [] });
  assert.equal(res.status, 400);
});

test("GET /api/vendas lista com header de soma e saldo", async () => {
  await criarVenda();
  const res = await agent.get("/api/vendas");
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.headers["x-sum-valor-total"], "200.00");
  assert.equal(res.body[0].saldoEmAbertoTitulos, 200);
});

test("GET /api/vendas aplica filtros diversos", async () => {
  await criarVenda();
  const porCliente = await agent.get("/api/vendas").query({ clienteId: ctx.cliente.id });
  assert.equal(porCliente.body.length, 1);
  const porVendedor = await agent.get("/api/vendas").query({ vendedorId: ctx.vendedor.id });
  assert.equal(porVendedor.body.length, 1);
  const semSaldo = await agent.get("/api/vendas").query({ valorMin: 500 });
  assert.equal(semSaldo.body.length, 0);
  const abertos = await agent.get("/api/vendas").query({ saldoEmAberto: "true" });
  assert.equal(abertos.body.length, 1);
  const busca = await agent.get("/api/vendas").query({ busca: "Cliente" });
  assert.equal(busca.body.length, 1);
  const ordem = await agent.get("/api/vendas").query({ ordem: "#1" });
  assert.equal(ordem.body.length, 1);
  const porData = await agent
    .get("/api/vendas")
    .query({ dataInicio: "2000-01-01", dataFim: "2100-01-01", motoristaId: "" });
  assert.equal(porData.body.length, 1);
});

test("GET /api/vendas/por-ordem/:numero", async () => {
  const v = await criarVenda();
  const ok = await agent.get(`/api/vendas/por-ordem/${v.body.numeroVenda}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.id, v.body.id);

  const bad = await agent.get("/api/vendas/por-ordem/abc");
  assert.equal(bad.status, 400);
  const missing = await agent.get("/api/vendas/por-ordem/999");
  assert.equal(missing.status, 404);
});

test("GET /api/vendas/:id inclui podeEditar", async () => {
  const v = await criarVenda();
  const res = await agent.get(`/api/vendas/${v.body.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.podeEditar, true);
  const missing = await agent.get("/api/vendas/9999");
  assert.equal(missing.status, 404);
});

test("PATCH /api/vendas/:id atualiza frete e recibo", async () => {
  const v = await criarVenda({ fretePorTonelada: 10 });
  const res = await agent
    .patch(`/api/vendas/${v.body.id}`)
    .send({ frete: 50, freteRecibo: true, freteReciboNum: "R-1" });
  assert.equal(res.status, 200);
  assert.equal(Number(res.body.frete), 50);
  assert.equal(res.body.freteRecibo, true);
  const fretes = await prisma.freteMovimento.findMany({ where: { vendaId: v.body.id } });
  assert.equal(Number(fretes[0].valor), 50);
});

test("PATCH /api/vendas/:id cria freteMovimento quando não havia", async () => {
  const v = await criarVenda(); // sem frete inicial
  const res = await agent.patch(`/api/vendas/${v.body.id}`).send({ frete: 30 });
  assert.equal(res.status, 200);
  const fretes = await prisma.freteMovimento.findMany({ where: { vendaId: v.body.id } });
  assert.equal(fretes.length, 1);
  assert.equal(Number(fretes[0].valor), 30);
});

test("PATCH /api/vendas/:id 404", async () => {
  const res = await agent.patch("/api/vendas/9999").send({ frete: 1 });
  assert.equal(res.status, 404);
});

test("PUT /api/vendas/:id edita venda sem baixas", async () => {
  const v = await criarVenda();
  const res = await agent.put(`/api/vendas/${v.body.id}`).send({
    clienteId: ctx.cliente.id,
    vendedorId: ctx.vendedor.id,
    itens: [{ produtoId: ctx.produtoTon.id, quantidade: 3, precoUnitario: 100 }],
    observacoes: "editada",
  });
  assert.equal(res.status, 200);
  assert.equal(Number(res.body.valorTotal), 300);
  assert.equal(res.body.observacoes, "editada");
  const titulos = await prisma.tituloReceber.findMany({ where: { vendaId: v.body.id } });
  assert.equal(Number(titulos[0].valorOriginal), 300);
});

test("PUT /api/vendas/:id bloqueia com pagamento", async () => {
  const v = await criarVenda();
  await prisma.pagamento.create({
    data: { tenantId: ctx.tenant.id, clienteId: ctx.cliente.id, vendaId: v.body.id, tipo: "dinheiro", valor: 10 },
  });
  const res = await agent.put(`/api/vendas/${v.body.id}`).send({
    clienteId: ctx.cliente.id,
    vendedorId: ctx.vendedor.id,
    itens: [{ produtoId: ctx.produtoTon.id, quantidade: 1, precoUnitario: 100 }],
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /baixas registradas/);
});

test("PUT /api/vendas/:id bloqueia com cheque vinculado", async () => {
  const v = await criarVenda();
  await prisma.cheque.create({
    data: {
      tenantId: ctx.tenant.id,
      numeroOrdem: 1,
      clienteId: ctx.cliente.id,
      vendaId: v.body.id,
      valor: 10,
    },
  });
  const res = await agent.put(`/api/vendas/${v.body.id}`).send({
    clienteId: ctx.cliente.id,
    vendedorId: ctx.vendedor.id,
    itens: [{ produtoId: ctx.produtoTon.id, quantidade: 1, precoUnitario: 100 }],
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /cheques vinculados/);
});

test("PUT /api/vendas/:id 404 e produto inexistente", async () => {
  const missing = await agent.put("/api/vendas/9999").send({
    clienteId: ctx.cliente.id,
    vendedorId: ctx.vendedor.id,
    itens: [{ produtoId: ctx.produtoTon.id, quantidade: 1, precoUnitario: 1 }],
  });
  assert.equal(missing.status, 404);

  const v = await criarVenda();
  const prodBad = await agent.put(`/api/vendas/${v.body.id}`).send({
    clienteId: ctx.cliente.id,
    vendedorId: ctx.vendedor.id,
    itens: [{ produtoId: 99999, quantidade: 1, precoUnitario: 1 }],
  });
  assert.equal(prodBad.status, 400);
});

test("DELETE /api/vendas/:id cancela venda", async () => {
  const v = await criarVenda();
  const res = await agent.delete(`/api/vendas/${v.body.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const found = await prisma.venda.findUnique({ where: { id: v.body.id } });
  assert.equal(found, null);
});

test("DELETE /api/vendas/:id bloqueia com pagamento e com cheque", async () => {
  const v1 = await criarVenda();
  await prisma.pagamento.create({
    data: { tenantId: ctx.tenant.id, clienteId: ctx.cliente.id, vendaId: v1.body.id, tipo: "dinheiro", valor: 5 },
  });
  const r1 = await agent.delete(`/api/vendas/${v1.body.id}`);
  assert.equal(r1.status, 400);

  const v2 = await criarVenda();
  await prisma.cheque.create({
    data: { tenantId: ctx.tenant.id, numeroOrdem: 1, clienteId: ctx.cliente.id, vendaId: v2.body.id, valor: 5 },
  });
  const r2 = await agent.delete(`/api/vendas/${v2.body.id}`);
  assert.equal(r2.status, 400);
});

test("DELETE /api/vendas/:id 404", async () => {
  const res = await agent.delete("/api/vendas/9999");
  assert.equal(res.status, 404);
});
