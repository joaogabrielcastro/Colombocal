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

test("GET /api/fretes?avulso=true omite frete da venda", async () => {
  const avulso = await agent.post("/api/fretes/avulso").send({
    clienteId: ctx.cliente.id,
    motoristaId: ctx.motorista.id,
    precoTonelada: 50,
    produtoId: ctx.produto.id,
    quantidade: 1,
  });
  assert.equal(avulso.status, 201);

  const vendedor = await seedVendedor(ctx.tenant.id);
  const venda = await agent.post("/api/vendas").send({
    clienteId: ctx.cliente.id,
    vendedorId: vendedor.id,
    itens: [{ produtoId: ctx.produto.id, quantidade: 2, precoUnitario: 100 }],
    fretePorTonelada: 10,
  });
  assert.equal(venda.status, 201);

  const all = await agent.get("/api/fretes");
  assert.equal(all.status, 200);
  assert.ok(all.body.some((r) => r.id === avulso.body.frete.id));
  assert.ok(all.body.some((r) => r.vendaId === venda.body.id));

  const onlyAvulso = await agent.get("/api/fretes?avulso=true");
  assert.equal(onlyAvulso.status, 200);
  assert.ok(onlyAvulso.body.every((r) => r.vendaId == null));
  assert.ok(onlyAvulso.body.some((r) => r.id === avulso.body.frete.id));
  assert.ok(!onlyAvulso.body.some((r) => r.vendaId === venda.body.id));
});

test("GET /api/fretes/:id/impressao rejeita frete da venda", async () => {
  const vendedor = await seedVendedor(ctx.tenant.id);
  const venda = await agent.post("/api/vendas").send({
    clienteId: ctx.cliente.id,
    vendedorId: vendedor.id,
    itens: [{ produtoId: ctx.produto.id, quantidade: 2, precoUnitario: 100 }],
    fretePorTonelada: 10,
  });
  const frete = await prisma.freteMovimento.findFirst({
    where: { vendaId: venda.body.id },
  });
  assert.ok(frete);

  const res = await agent.get(`/api/fretes/${frete.id}/impressao`);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /avulso/i);
});

test("POST /api/fretes/avulso não gera título nem pagamento (só operacional)", async () => {
  const res = await agent.post("/api/fretes/avulso").send({
    clienteId: ctx.cliente.id,
    motoristaId: ctx.motorista.id,
    precoTonelada: 50,
    produtoId: ctx.produto.id,
    quantidade: 2,
  });
  assert.equal(res.status, 201);
  assert.equal(Number(res.body.frete.valor), 100);
  assert.equal(res.body.titulo, null);
  assert.equal(res.body.pagamento, null);
  assert.equal(res.body.frete.reciboEmitido, true); // Colombocal / default
  assert.equal(res.body.resumoImpressao.valorFinal, 100);
  const titulo = await prisma.tituloReceber.findFirst({
    where: { numero: `FRETE-AVULSO-${res.body.frete.id}` },
  });
  assert.equal(titulo, null);
});

test("POST /api/fretes/avulso pagoNoAto também sem financeiro", async () => {
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
  assert.equal(res.body.pagamento, null);
  assert.equal(res.body.titulo, null);
  assert.equal(res.body.frete.reciboEmitido, true);
  const pags = await prisma.pagamento.findMany({
    where: { clienteId: ctx.cliente.id },
  });
  assert.equal(pags.length, 0);
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
  assert.equal(naoEmitidos.body.length, 0);

  const emitidos = await agent.get("/api/fretes").query({ reciboEmitido: "true" });
  assert.equal(emitidos.body.length, 1);

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

test("DELETE /api/fretes/:id remove frete avulso", async () => {
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
