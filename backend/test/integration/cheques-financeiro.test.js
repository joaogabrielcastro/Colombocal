const test = require("node:test");
const assert = require("node:assert/strict");
const { agent, prisma, resetDb, seedBase } = require("../helpers/testServer");
const { excluirCheque } = require("../../src/application/use-cases/excluirCheque");

test.beforeEach(async () => {
  await resetDb();
});

async function criarVendaComTitulo(ctx, valor = 200) {
  const vendaRes = await agent.post("/api/vendas").send({
    clienteId: ctx.cliente.id,
    vendedorId: ctx.vendedor.id,
    itens: [{ produtoId: ctx.produto.id, quantidade: 1, precoUnitario: valor }],
  });
  assert.equal(vendaRes.status, 201);
  return vendaRes.body;
}

test("cheque registra status registrado e abate título uma vez", async () => {
  const ctx = await seedBase();
  const venda = await criarVendaComTitulo(ctx, 200);

  const cheque = await agent.post("/api/cheques").send({
    clienteId: ctx.cliente.id,
    vendaId: venda.id,
    valor: 80,
    emitenteNome: "Cliente Teste",
    banco: "001",
    numero: "123",
  });
  assert.equal(cheque.status, 201);
  assert.equal(cheque.body.cheque.status, "registrado");
  const chequeId = cheque.body.cheque.id;

  const titulos = await prisma.tituloReceber.findMany({
    where: { tenantId: ctx.tenant.id, vendaId: venda.id },
  });
  assert.equal(titulos.length, 1);
  assert.equal(Number(titulos[0].valorPago), 80);
  assert.equal(titulos[0].status, "parcial");

  const pags = await prisma.pagamento.findMany({
    where: { tenantId: ctx.tenant.id, chequeId },
  });
  assert.equal(pags.length, 1);
  assert.equal(pags[0].tipo, "cheque");
  assert.equal(Number(pags[0].valor), 80);
});

test("dois cheques abatem sem duplicar o mesmo pagamento", async () => {
  const ctx = await seedBase();
  const venda = await criarVendaComTitulo(ctx, 200);

  const c1 = await agent.post("/api/cheques").send({
    clienteId: ctx.cliente.id,
    vendaId: venda.id,
    valor: 50,
    emitenteNome: "Emitente A",
  });
  const c2 = await agent.post("/api/cheques").send({
    clienteId: ctx.cliente.id,
    vendaId: venda.id,
    valor: 70,
    emitenteNome: "Emitente B",
  });
  assert.equal(c1.status, 201, c1.body?.error || JSON.stringify(c1.body));
  assert.equal(c2.status, 201, c2.body?.error || JSON.stringify(c2.body));

  const titulo = await prisma.tituloReceber.findFirst({
    where: { tenantId: ctx.tenant.id, vendaId: venda.id },
  });
  assert.equal(Number(titulo.valorPago), 120);
  assert.equal(titulo.status, "parcial");

  const pags = await prisma.pagamento.findMany({
    where: { tenantId: ctx.tenant.id, vendaId: venda.id, tipo: "cheque" },
  });
  assert.equal(pags.length, 2);
});

test("excluir cheque remove pagamento e recalcula título", async () => {
  const ctx = await seedBase();
  const venda = await criarVendaComTitulo(ctx, 100);

  const cheque = await agent.post("/api/cheques").send({
    clienteId: ctx.cliente.id,
    vendaId: venda.id,
    valor: 100,
    emitenteNome: "Quitacao",
  });
  assert.equal(cheque.status, 201);
  const chequeId = cheque.body.cheque.id;

  let titulo = await prisma.tituloReceber.findFirst({
    where: { tenantId: ctx.tenant.id, vendaId: venda.id },
  });
  assert.equal(titulo.status, "quitado");
  assert.equal(Number(titulo.valorPago), 100);

  await excluirCheque(prisma, chequeId, ctx.tenant.id, {
    id: 1,
    email: "admin@test",
  });

  titulo = await prisma.tituloReceber.findFirst({
    where: { tenantId: ctx.tenant.id, vendaId: venda.id },
  });
  assert.equal(Number(titulo.valorPago), 0);
  assert.equal(titulo.status, "aberto");

  const pags = await prisma.pagamento.findMany({
    where: { tenantId: ctx.tenant.id, chequeId },
  });
  assert.equal(pags.length, 0);
});

test("POST /api/cheques rejeita payload inválido", async () => {
  const ctx = await seedBase();
  const bad = await agent.post("/api/cheques").send({
    clienteId: ctx.cliente.id,
    valor: -10,
  });
  assert.equal(bad.status, 400);
});
