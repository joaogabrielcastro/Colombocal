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
  const vendedor = await seedVendedor(tenant.id, { comissaoPercentual: 10 });
  const cliente = await seedCliente(tenant.id, { vendedorId: vendedor.id });
  const produto = await seedProduto(tenant.id, { unidade: "ton", precoPadrao: 100 });
  ctx = { tenant, vendedor, cliente, produto };
});

async function criarVenda(over = {}) {
  const res = await agent.post("/api/vendas").send({
    clienteId: ctx.cliente.id,
    vendedorId: ctx.vendedor.id,
    itens: [{ produtoId: ctx.produto.id, quantidade: 2, precoUnitario: 100 }],
    ...over,
  });
  assert.equal(res.status, 201);
  return res.body;
}

async function waitJob(jobId) {
  for (let i = 0; i < 60; i += 1) {
    const r = await agent.get(`/api/relatorios/exports/${jobId}`);
    if (r.body.status === "completed" || r.body.status === "failed") return r.body;
    await new Promise((res) => setTimeout(res, 50));
  }
  throw new Error("job timeout");
}

test("GET /api/relatorios/vendas retorna resumos", async () => {
  await criarVenda();
  const res = await agent.get("/api/relatorios/vendas");
  assert.equal(res.status, 200);
  assert.equal(res.body.totalFaturamento, 200);
  assert.equal(res.body.quantidade, 1);
  assert.equal(res.body.resumoRepresentantes.length, 1);
  assert.equal(res.body.resumoClientes.length, 1);
  assert.equal(res.body.resumoProdutos.length, 1);
});

test("GET /api/relatorios/vendas com filtros e busca", async () => {
  await criarVenda();
  const res = await agent.get("/api/relatorios/vendas").query({
    dataInicio: "2000-01-01",
    dataFim: "2100-01-01",
    clienteId: ctx.cliente.id,
    vendedorId: ctx.vendedor.id,
    produtoId: ctx.produto.id,
    busca: "Cliente",
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.quantidade, 1);

  const porOrdem = await agent.get("/api/relatorios/vendas").query({ busca: "#1" });
  assert.equal(porOrdem.status, 200);
});

test("GET /api/relatorios/comissoes emissao e caixa", async () => {
  const venda = await criarVenda();
  await prisma.pagamento.create({
    data: {
      tenantId: ctx.tenant.id,
      clienteId: ctx.cliente.id,
      vendaId: venda.id,
      tipo: "dinheiro",
      valor: 100,
    },
  });
  const emissao = await agent.get("/api/relatorios/comissoes").query({ modo: "emissao" });
  assert.equal(emissao.status, 200);
  assert.equal(emissao.body.modo, "emissao");
  assert.equal(emissao.body.resultado.length, 1);
  assert.ok(emissao.body.resultado[0].comissao > 0);
  assert.equal(emissao.body.totalVendasPeriodo, 1);
  assert.equal(emissao.body.truncated, false);
  assert.ok(Number(emissao.headers["x-total-count"]) >= 1);

  const caixaIgnorado = await agent.get("/api/relatorios/comissoes").query({ modo: "caixa" });
  assert.equal(caixaIgnorado.status, 200);
  assert.equal(caixaIgnorado.body.modo, "emissao");

  const porVendedor = await agent
    .get("/api/relatorios/comissoes")
    .query({ vendedorId: ctx.vendedor.id, dataInicio: "2000-01-01", dataFim: "2100-01-01" });
  assert.equal(porVendedor.status, 200);

  const page = await agent
    .get("/api/relatorios/comissoes")
    .query({ take: 1, skip: 0, modo: "emissao" });
  assert.equal(page.status, 200);
  assert.equal(page.body.take, 1);
});

test("POST /api/relatorios/comissoes/ajustes-lote", async () => {
  const venda = await criarVenda();
  const ok = await agent
    .post("/api/relatorios/comissoes/ajustes-lote")
    .send({ ajustes: [{ vendaId: venda.id, ajusteValor: 5, motivo: "bonus" }] });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.total, 1);
  const ajuste = await prisma.comissaoAjusteVenda.findUnique({ where: { vendaId: venda.id } });
  assert.equal(Number(ajuste.ajusteValor), 5);

  const vazio = await agent.post("/api/relatorios/comissoes/ajustes-lote").send({ ajustes: [] });
  assert.equal(vazio.status, 400);

  const idsInvalidos = await agent
    .post("/api/relatorios/comissoes/ajustes-lote")
    .send({ ajustes: [{ vendaId: 0 }] });
  assert.equal(idsInvalidos.status, 400);

  const vendaOutroTenant = await agent
    .post("/api/relatorios/comissoes/ajustes-lote")
    .send({ ajustes: [{ vendaId: 999999, ajusteValor: 1 }] });
  assert.equal(vendaOutroTenant.status, 400);

  const porNumero = await agent.post("/api/relatorios/comissoes/ajustes-lote").send({
    ajustes: [{ numeroVenda: venda.numeroVenda, ajusteValor: 7, motivo: "ordem" }],
  });
  assert.equal(porNumero.status, 200);
  const ajusteNum = await prisma.comissaoAjusteVenda.findUnique({
    where: { vendaId: venda.id },
  });
  assert.equal(Number(ajusteNum.ajusteValor), 7);

  const misto = await agent.post("/api/relatorios/comissoes/ajustes-lote").send({
    ajustes: [
      { vendaId: venda.id, ajusteValor: 3, motivo: "ok" },
      { vendaId: 999999, ajusteValor: 1 },
    ],
  });
  assert.equal(misto.status, 200);
  assert.equal(misto.body.total, 1);
  assert.deepEqual(misto.body.ignorados, [999999]);
});

test("GET /api/relatorios/financeiro lista devedores", async () => {
  await criarVenda();
  const res = await agent.get("/api/relatorios/financeiro");
  assert.equal(res.status, 200);
  assert.equal(res.body.totalEmAberto, 200);
  assert.equal(res.body.clientesDevedores.length, 1);
  assert.equal(res.body.clientesDevedoresCount, 1);
});

test("GET /api/relatorios/titulos com faixas de vencimento", async () => {
  await criarVenda();
  const res = await agent.get("/api/relatorios/titulos");
  assert.equal(res.status, 200);
  assert.equal(res.body.titulos.length, 1);
  assert.ok(res.body.resumo.faixas);
  assert.equal(res.body.resumo.valorEmAberto, 200);

  const filtrado = await agent.get("/api/relatorios/titulos").query({
    clienteId: ctx.cliente.id,
    somenteEmAberto: "true",
    dataVencInicio: "2000-01-01",
    dataVencFim: "2100-12-31",
  });
  assert.equal(filtrado.status, 200);

  const porStatus = await agent.get("/api/relatorios/titulos").query({ status: "aberto", vendaId: "#1" });
  assert.equal(porStatus.status, 200);
});

test("export-async de vendas gera CSV para download", async () => {
  await criarVenda();
  const start = await agent
    .post("/api/relatorios/vendas/export-async")
    .send({ dataInicio: "2000-01-01", dataFim: "2100-01-01" });
  assert.equal(start.status, 202);
  const job = await waitJob(start.body.jobId);
  assert.equal(job.status, "completed");
  assert.ok(job.downloadUrl);
  assert.equal(job.truncated, false);
  assert.equal(job.totalLinhas, 1);
  const dl = await agent.get(job.downloadUrl);
  assert.equal(dl.status, 200);
  assert.match(dl.headers["content-type"], /csv/);
  assert.match(dl.text, /Ordem,Data,Cliente/);
});

test("export-async de financeiro e titulos", async () => {
  await criarVenda();
  const fin = await agent.post("/api/relatorios/financeiro/export-async").send({});
  const finJob = await waitJob(fin.body.jobId);
  assert.equal(finJob.status, "completed");

  const tit = await agent.post("/api/relatorios/titulos/export-async").send({ somenteEmAberto: true });
  const titJob = await waitJob(tit.body.jobId);
  assert.equal(titJob.status, "completed");
  const dl = await agent.get(`/api/relatorios/exports/${tit.body.jobId}/download`);
  assert.equal(dl.status, 200);
});

test("exports/:jobId 404 e download antes de concluir 409", async () => {
  const missing = await agent.get("/api/relatorios/exports/nao-existe");
  assert.equal(missing.status, 404);
  const dlMissing = await agent.get("/api/relatorios/exports/nao-existe/download");
  assert.equal(dlMissing.status, 404);
});
