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
  const cliente = await seedCliente(tenant.id, {
    vendedorId: vendedor.id,
    razaoSocial: "Pátio LTDA",
    nomeFantasia: "Pátio",
  });
  const dolomitaTon = await seedProduto(tenant.id, {
    nome: "DOLOMITA M-325",
    unidade: "ton",
    codigo: "DOL325",
    precoPadrao: 320,
  });
  const dolomita25 = await seedProduto(tenant.id, {
    nome: "DOLOMITA M-40",
    unidade: "ton",
    pesoKg: 25,
    codigo: "DOL40",
    precoPadrao: 300,
  });
  const calSaco = await seedProduto(tenant.id, {
    nome: "Cal Saco",
    unidade: "saco",
    codigo: "CALS",
    precoPadrao: 20,
  });
  ctx = { tenant, vendedor, cliente, dolomitaTon, dolomita25, calSaco };
});

function qtd(item) {
  return Number(item.quantidade);
}

async function criarVenda({ produto, quantidade, precoUnitario = 100 }) {
  return agent.post("/api/vendas").send({
    clienteId: ctx.cliente.id,
    vendedorId: ctx.vendedor.id,
    itens: [{ produtoId: produto.id, quantidade, precoUnitario }],
  });
}

test("POST /api/ordens-carregamento grava itens já em SAC", async () => {
  const res = await agent.post("/api/ordens-carregamento").send({
    clienteId: ctx.cliente.id,
    clienteNome: "Pátio",
    itens: [
      { descricao: "DOLOMITA M-325", quantidade: 160, unidade: "SAC" },
    ],
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.numeroOc, 1);
  assert.equal(res.body.clienteNome, "Pátio");
  assert.equal(res.body.itens.length, 1);
  assert.equal(qtd(res.body.itens[0]), 160);
  assert.equal(res.body.itens[0].unidade, "SAC");
});

test("POST /api/ordens-carregamento exige cliente e item com quantidade", async () => {
  const semCliente = await agent.post("/api/ordens-carregamento").send({
    itens: [{ descricao: "Cal", quantidade: 10, unidade: "SAC" }],
  });
  assert.equal(semCliente.status, 400);

  const semItem = await agent.post("/api/ordens-carregamento").send({
    clienteNome: "Pátio",
    itens: [],
  });
  assert.equal(semItem.status, 400);

  const qtdZero = await agent.post("/api/ordens-carregamento").send({
    clienteNome: "Pátio",
    itens: [{ descricao: "Cal", quantidade: 0, unidade: "SAC" }],
  });
  assert.equal(qtdZero.status, 400);
});

test("POST a partir da venda: produto em saco permanece 160 SAC", async () => {
  const venda = await criarVenda({ produto: ctx.calSaco, quantidade: 160 });
  assert.equal(venda.status, 201);

  const oc = await agent
    .post("/api/ordens-carregamento")
    .send({ vendaId: venda.body.id });
  assert.equal(oc.status, 201);
  assert.equal(oc.body.vendaId, venda.body.id);
  assert.equal(oc.body.pedido, String(venda.body.numeroVenda).padStart(6, "0"));
  assert.equal(qtd(oc.body.itens[0]), 160);
  assert.equal(oc.body.itens[0].unidade, "SAC");
});

test("POST a partir da venda: dolomita em ton sem pesoKg (160 t = 8.000 SAC)", async () => {
  const venda = await criarVenda({
    produto: ctx.dolomitaTon,
    quantidade: 160,
    precoUnitario: 320,
  });
  assert.equal(venda.status, 201);

  const oc = await agent
    .post("/api/ordens-carregamento")
    .send({ vendaId: venda.body.id });
  assert.equal(oc.status, 201);
  assert.equal(oc.body.itens[0].descricao, "DOLOMITA M-325");
  assert.equal(qtd(oc.body.itens[0]), 8000);
  assert.equal(oc.body.itens[0].unidade, "SAC");
});

test("POST a partir da venda: dolomita 25 kg (4 t = 160 SAC)", async () => {
  const venda = await criarVenda({
    produto: ctx.dolomita25,
    quantidade: 4,
    precoUnitario: 300,
  });
  assert.equal(venda.status, 201);

  const oc = await agent
    .post("/api/ordens-carregamento")
    .send({ vendaId: venda.body.id });
  assert.equal(oc.status, 201);
  assert.equal(qtd(oc.body.itens[0]), 160);
});

test("PUT /api/ordens-carregamento/:id corrige quantidade já gravada", async () => {
  const created = await agent.post("/api/ordens-carregamento").send({
    clienteNome: "Pátio",
    itens: [{ descricao: "DOLOMITA M-325", quantidade: 8000, unidade: "SAC" }],
  });
  assert.equal(created.status, 201);

  const updated = await agent
    .put(`/api/ordens-carregamento/${created.body.id}`)
    .send({
      clienteNome: "Pátio",
      itens: [{ descricao: "DOLOMITA M-325", quantidade: 160, unidade: "SAC" }],
    });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.itens.length, 1);
  assert.equal(qtd(updated.body.itens[0]), 160);
});

test("GET lista e detalhe; DELETE remove a OC", async () => {
  const created = await agent.post("/api/ordens-carregamento").send({
    clienteNome: "Pátio",
    pedido: "000010",
    itens: [{ descricao: "Cal", quantidade: 10, unidade: "SAC" }],
  });
  assert.equal(created.status, 201);

  const list = await agent.get("/api/ordens-carregamento?cliente=Pátio");
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].numeroOc, 1);

  const detail = await agent.get(`/api/ordens-carregamento/${created.body.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.pedido, "000010");

  const del = await agent.delete(`/api/ordens-carregamento/${created.body.id}`);
  assert.equal(del.status, 200);
  const missing = await agent.get(`/api/ordens-carregamento/${created.body.id}`);
  assert.equal(missing.status, 404);

  const rows = await prisma.ordemCarregamento.count();
  assert.equal(rows, 0);
});

test("numeroOc incrementa por tenant", async () => {
  const a = await agent.post("/api/ordens-carregamento").send({
    clienteNome: "Pátio",
    itens: [{ descricao: "Cal", quantidade: 1, unidade: "SAC" }],
  });
  const b = await agent.post("/api/ordens-carregamento").send({
    clienteNome: "Pátio",
    itens: [{ descricao: "Cal", quantidade: 2, unidade: "SAC" }],
  });
  assert.equal(a.body.numeroOc, 1);
  assert.equal(b.body.numeroOc, 2);
});
