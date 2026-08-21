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
  const tenant = await seedTenant(); // slug default => frete habilitado
  const cliente = await seedCliente(tenant.id);
  const motorista = await seedMotorista(tenant.id);
  const produto = await seedProduto(tenant.id, { unidade: "ton", precoPadrao: 100 });
  ctx = { tenant, cliente, motorista, produto };
});

test("POST /api/fretes/avulso gera título quando não pago no ato", async () => {
  const res = await agent.post("/api/fretes/avulso").send({
    clienteId: ctx.cliente.id,
    motoristaId: ctx.motorista.id,
    precoTonelada: 50,
    produtoId: ctx.produto.id,
    quantidade: 2,
  });
  assert.equal(res.status, 201);
  assert.equal(Number(res.body.frete.valor), 100);
  assert.ok(res.body.titulo);
  assert.equal(res.body.pagamento, null);
  assert.equal(res.body.resumoImpressao.valorFinal, 100);
});

test("POST /api/fretes/avulso pago no ato cria pagamento", async () => {
  const res = await agent.post("/api/fretes/avulso").send({
    clienteId: ctx.cliente.id,
    motoristaId: ctx.motorista.id,
    precoTonelada: 50,
    produtoId: ctx.produto.id,
    quantidade: 1,
    pagoNoAto: true,
    pagamentoTipo: "transferencia",
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.pagamento);
  assert.equal(res.body.pagamento.tipo, "transferencia");
  assert.equal(res.body.titulo, null);
});

test("POST /api/fretes/avulso aceita itens em lote e valorTotal informado", async () => {
  const p2 = await seedProduto(ctx.tenant.id, { unidade: "saco", precoPadrao: 10, codigo: "S2" });
  const res = await agent.post("/api/fretes/avulso").send({
    clienteId: ctx.cliente.id,
    motoristaId: ctx.motorista.id,
    precoSaco: 2,
    precoTonelada: 50,
    valorTotal: 999,
    itens: [
      { produtoId: ctx.produto.id, quantidade: 1 },
      { produtoId: p2.id, quantidade: 5 },
    ],
  });
  assert.equal(res.status, 201);
  assert.equal(Number(res.body.frete.valor), 999);
});

test("POST /api/fretes/avulso valida cliente/motorista/produto", async () => {
  const semCliente = await agent.post("/api/fretes/avulso").send({
    clienteId: 9999,
    motoristaId: ctx.motorista.id,
    produtoId: ctx.produto.id,
    quantidade: 1,
  });
  assert.equal(semCliente.status, 404);

  const semMot = await agent.post("/api/fretes/avulso").send({
    clienteId: ctx.cliente.id,
    motoristaId: 9999,
    produtoId: ctx.produto.id,
    quantidade: 1,
  });
  assert.equal(semMot.status, 404);

  const semProd = await agent.post("/api/fretes/avulso").send({
    clienteId: ctx.cliente.id,
    motoristaId: ctx.motorista.id,
    produtoId: 9999,
    quantidade: 1,
  });
  assert.equal(semProd.status, 404);
});

test("GET /api/fretes lista com filtros", async () => {
  await agent.post("/api/fretes/avulso").send({
    clienteId: ctx.cliente.id,
    motoristaId: ctx.motorista.id,
    precoTonelada: 50,
    produtoId: ctx.produto.id,
    quantidade: 2,
  });
  const all = await agent.get("/api/fretes");
  assert.equal(all.status, 200);
  assert.equal(all.body.length, 1);

  const porCliente = await agent.get("/api/fretes").query({ clienteId: ctx.cliente.id });
  assert.equal(porCliente.body.length, 1);

  const naoEmitidos = await agent.get("/api/fretes").query({ reciboEmitido: "false" });
  assert.equal(naoEmitidos.body.length, 1);

  const emitidos = await agent.get("/api/fretes").query({ reciboEmitido: "true" });
  assert.equal(emitidos.body.length, 0);

  const porData = await agent
    .get("/api/fretes")
    .query({ dataInicio: "2000-01-01", dataFim: "2100-01-01" });
  assert.equal(porData.body.length, 1);
});

test("PATCH /api/fretes/:id atualiza recibo e sincroniza venda", async () => {
  // frete vinculado a venda
  const vendedor = await seedVendedor(ctx.tenant.id);
  const venda = await prisma.venda.create({
    data: {
      tenantId: ctx.tenant.id,
      numeroVenda: 1,
      clienteId: ctx.cliente.id,
      vendedorId: vendedor.id,
      valorTotal: 100,
    },
  });
  const frete = await prisma.freteMovimento.create({
    data: { tenantId: ctx.tenant.id, vendaId: venda.id, clienteId: ctx.cliente.id, valor: 30 },
  });
  const res = await agent
    .patch(`/api/fretes/${frete.id}`)
    .send({ reciboEmitido: true, reciboNumero: "RC-9", valor: 45, observacao: "ok" });
  assert.equal(res.status, 200);
  assert.equal(res.body.reciboEmitido, true);
  assert.equal(Number(res.body.valor), 45);
  const vendaAtual = await prisma.venda.findUnique({ where: { id: venda.id } });
  assert.equal(vendaAtual.freteRecibo, true);
  assert.equal(vendaAtual.freteReciboNum, "RC-9");
});

test("PATCH /api/fretes/:id 404", async () => {
  const res = await agent.patch("/api/fretes/9999").send({ reciboEmitido: true });
  assert.equal(res.status, 404);
});

test("POST /api/fretes/vale-avulso cria frete e título", async () => {
  const res = await agent.post("/api/fretes/vale-avulso").send({
    clienteId: ctx.cliente.id,
    valor: 75,
    motoristaId: ctx.motorista.id,
    produtoId: ctx.produto.id,
    observacao: "vale teste",
  });
  assert.equal(res.status, 201);
  assert.equal(Number(res.body.titulo.valorOriginal), 75);
  assert.match(res.body.titulo.numero, /^VALE-FRETE-/);
});

test("POST /api/fretes/vale-avulso sem motorista/produto", async () => {
  const res = await agent.post("/api/fretes/vale-avulso").send({
    clienteId: ctx.cliente.id,
    valor: 20,
  });
  assert.equal(res.status, 201);
});

test("POST /api/fretes/:id/vale usa valor do frete ou do body", async () => {
  const frete = await prisma.freteMovimento.create({
    data: { tenantId: ctx.tenant.id, clienteId: ctx.cliente.id, valor: 40 },
  });
  const doFrete = await agent.post(`/api/fretes/${frete.id}/vale`).send({});
  assert.equal(doFrete.status, 201);
  assert.equal(Number(doFrete.body.valorOriginal), 40);

  const doBody = await agent.post(`/api/fretes/${frete.id}/vale`).send({ valor: 88 });
  assert.equal(doBody.status, 201);
  assert.equal(Number(doBody.body.valorOriginal), 88);
});

test("POST /api/fretes/:id/vale 404", async () => {
  const res = await agent.post("/api/fretes/9999/vale").send({ valor: 10 });
  assert.equal(res.status, 404);
});

test("DELETE /api/fretes/:id remove frete avulso e título", async () => {
  const created = await agent.post("/api/fretes/avulso").send({
    clienteId: ctx.cliente.id,
    motoristaId: ctx.motorista.id,
    precoTonelada: 50,
    produtoId: ctx.produto.id,
    quantidade: 2,
  });
  assert.equal(created.status, 201);
  const freteId = created.body.frete.id;

  const del = await agent.delete(`/api/fretes/${freteId}`);
  assert.equal(del.status, 200);
  assert.equal(del.body.ok, true);

  const gone = await prisma.freteMovimento.findUnique({ where: { id: freteId } });
  assert.equal(gone, null);
  const titulo = await prisma.tituloReceber.findFirst({
    where: { numero: `FRETE-AVULSO-${freteId}` },
  });
  assert.equal(titulo, null);
});

test("DELETE /api/fretes/:id permite frete da venda sem alterar a venda", async () => {
  const vendedor = await seedVendedor(ctx.tenant.id);
  const venda = await prisma.venda.create({
    data: {
      tenantId: ctx.tenant.id,
      numeroVenda: 99,
      clienteId: ctx.cliente.id,
      vendedorId: vendedor.id,
      valorTotal: 100,
      frete: 45,
      freteTarifaSaco: 2,
      freteTarifaTonelada: 10,
      freteRecibo: true,
      freteReciboNum: "RC-1",
    },
  });
  const frete = await prisma.freteMovimento.create({
    data: {
      tenantId: ctx.tenant.id,
      vendaId: venda.id,
      clienteId: ctx.cliente.id,
      valor: 45,
      reciboEmitido: true,
      reciboNumero: "RC-1",
    },
  });

  const del = await agent.delete(`/api/fretes/${frete.id}`);
  assert.equal(del.status, 200);

  const gone = await prisma.freteMovimento.findUnique({ where: { id: frete.id } });
  assert.equal(gone, null);

  const vendaAtual = await prisma.venda.findUnique({ where: { id: venda.id } });
  assert.equal(Number(vendaAtual.frete), 45);
  assert.equal(Number(vendaAtual.freteTarifaSaco), 2);
  assert.equal(Number(vendaAtual.freteTarifaTonelada), 10);
  assert.equal(vendaAtual.freteRecibo, true);
  assert.equal(vendaAtual.freteReciboNum, "RC-1");
});
