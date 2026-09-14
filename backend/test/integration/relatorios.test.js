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
  const vendedor = await seedVendedor(tenant.id, { comissaoPercentual: 10 });
  const motorista = await seedMotorista(tenant.id);
  const cliente = await seedCliente(tenant.id, { vendedorId: vendedor.id });
  const produto = await seedProduto(tenant.id, { unidade: "ton", precoPadrao: 100 });
  ctx = { tenant, vendedor, motorista, cliente, produto };
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
  assert.ok(Array.isArray(res.body.resumoClienteProdutos));
  assert.equal(res.body.resumoClienteProdutos.length, 1);
  assert.equal(res.body.resumoClienteProdutos[0].produtos[0].quantidade, 2);
  assert.equal(res.body.resumoClienteProdutos[0].produtos[0].unidade, "ton");
  assert.ok(res.body.evolucao);
  assert.ok(Array.isArray(res.body.evolucao.pontos));
  assert.ok(["dia", "mes"].includes(res.body.evolucao.granularidade));
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

test("GET /api/relatorios/vendas filtra por motoristaId", async () => {
  await criarVenda({ motoristaId: ctx.motorista.id });
  await criarVenda(); // sem motorista

  const comMotorista = await agent.get("/api/relatorios/vendas").query({
    motoristaId: ctx.motorista.id,
  });
  assert.equal(comMotorista.status, 200);
  assert.equal(comMotorista.body.quantidade, 1);
  assert.equal(comMotorista.body.totalFaturamento, 200);

  const outro = await agent.get("/api/relatorios/vendas").query({ motoristaId: 99999 });
  assert.equal(outro.status, 200);
  assert.equal(outro.body.quantidade, 0);
});

test("GET /api/relatorios/vendas filtra por produtoBusca (nome parcial)", async () => {
  const dolomitaA = await seedProduto(ctx.tenant.id, {
    nome: "DOLOMITA M-325 ENSACADA",
    codigo: "DOL325",
    unidade: "ton",
    precoPadrao: 340,
  });
  const dolomitaB = await seedProduto(ctx.tenant.id, {
    nome: "DOLOMITA M-200 ENSACADA",
    codigo: "DOL200",
    unidade: "ton",
    precoPadrao: 320,
  });
  const cal = await seedProduto(ctx.tenant.id, {
    nome: "CAL HIDRATADA CH-III",
    codigo: "CALCH3",
    unidade: "saco",
    precoPadrao: 50,
  });
  const clienteDolo = await seedCliente(ctx.tenant.id, {
    vendedorId: ctx.vendedor.id,
    cnpj: "33444555000173",
    razaoSocial: "Cliente Dolomita LTDA",
    nomeFantasia: "Cliente Dolomita",
  });
  const clienteCal = await seedCliente(ctx.tenant.id, {
    vendedorId: ctx.vendedor.id,
    cnpj: "22333444000192",
    razaoSocial: "Cliente Cal LTDA",
    nomeFantasia: "Cliente Cal",
  });

  await agent.post("/api/vendas").send({
    clienteId: clienteDolo.id,
    vendedorId: ctx.vendedor.id,
    itens: [
      { produtoId: dolomitaA.id, quantidade: 2, precoUnitario: 340 },
      { produtoId: dolomitaB.id, quantidade: 1, precoUnitario: 320 },
      { produtoId: cal.id, quantidade: 10, precoUnitario: 50 },
    ],
  }).then((r) => assert.equal(r.status, 201));

  await agent.post("/api/vendas").send({
    clienteId: clienteCal.id,
    vendedorId: ctx.vendedor.id,
    itens: [{ produtoId: cal.id, quantidade: 5, precoUnitario: 50 }],
  }).then((r) => assert.equal(r.status, 201));

  const res = await agent.get("/api/relatorios/vendas").query({
    dataInicio: "2000-01-01",
    dataFim: "2100-01-01",
    produtoBusca: "dolomita",
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.quantidade, 1);
  assert.equal(res.body.resumoClientes.length, 1);
  assert.equal(res.body.resumoClientes[0].clienteNome, "Cliente Dolomita");
  // Produtos por cliente: só linhas de dolomita (não inclui cal da mesma venda)
  assert.equal(res.body.resumoClienteProdutos.length, 1);
  assert.equal(res.body.resumoClienteProdutos[0].produtos.length, 2);
  assert.ok(
    res.body.resumoClienteProdutos[0].produtos.every((p) =>
      String(p.produtoNome).toUpperCase().includes("DOLOMITA"),
    ),
  );
  assert.equal(res.body.resumoProdutos.length, 2);
  assert.ok(
    res.body.resumoProdutos.every((p) =>
      String(p.produtoNome).toUpperCase().includes("DOLOMITA"),
    ),
  );
});

test("GET /api/relatorios/vendas somenteDetalhes não recalcula agregados", async () => {
  await criarVenda();
  const res = await agent.get("/api/relatorios/vendas").query({
    somenteDetalhes: "true",
    take: 10,
    skip: 0,
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.quantidade, 1);
  assert.equal(res.body.vendas.length, 1);
  assert.equal(res.body.resumoRepresentantes, undefined);
  assert.ok(res.body.totalRegistros >= 1);
});

test("GET /api/relatorios/vendas evolução respeita filtros de data e representante", async () => {
  await criarVenda();
  const outroVendedor = await seedVendedor(ctx.tenant.id, { nome: "Outro Rep", comissaoPercentual: 5 });
  const outroCliente = await seedCliente(ctx.tenant.id, {
    vendedorId: outroVendedor.id,
    cnpj: "22333444000192",
    razaoSocial: "Outro Cliente LTDA",
    nomeFantasia: "Outro Cliente",
  });
  await agent.post("/api/vendas").send({
    clienteId: outroCliente.id,
    vendedorId: outroVendedor.id,
    itens: [{ produtoId: ctx.produto.id, quantidade: 1, precoUnitario: 100 }],
  });

  const filtrado = await agent.get("/api/relatorios/vendas").query({
    dataInicio: "2000-01-01",
    dataFim: "2100-01-01",
    vendedorId: ctx.vendedor.id,
  });
  assert.equal(filtrado.status, 200);
  assert.equal(filtrado.body.quantidade, 1);
  assert.equal(filtrado.body.totalFaturamento, 200);
  const qtdEvolucao = filtrado.body.evolucao.pontos.reduce((acc, p) => acc + p.quantidade, 0);
  assert.equal(qtdEvolucao, 1);
  const fatEvolucao = filtrado.body.evolucao.pontos.reduce((acc, p) => acc + p.faturamento, 0);
  assert.equal(fatEvolucao, 200);
});

test("GET /api/relatorios/vendas: totais e evolução não dependem do take da página", async () => {
  await criarVenda();
  await criarVenda();
  const res = await agent.get("/api/relatorios/vendas").query({
    dataInicio: "2000-01-01",
    dataFim: "2100-01-01",
    take: 1,
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.quantidade, 1);
  assert.equal(res.body.vendas.length, 1);
  assert.equal(res.body.totalRegistros, 2);
  assert.equal(res.body.totalFaturamento, 400);
  assert.equal(res.body.resumoRepresentantes[0].quantidadeVendas, 2);
  assert.equal(res.body.resumoClientes[0].quantidadeVendas, 2);
  const qtdEvo = res.body.evolucao.pontos.reduce((acc, p) => acc + p.quantidade, 0);
  assert.equal(qtdEvo, 2);
  const fatEvo = res.body.evolucao.pontos.reduce((acc, p) => acc + p.faturamento, 0);
  assert.equal(fatEvo, 400);
  const ticket = res.body.totalFaturamento / res.body.totalRegistros;
  assert.equal(ticket, 200);
});

test("GET /api/relatorios/vendas: combinação de filtros e conjunto vazio", async () => {
  await criarVenda();
  const outroVendedor = await seedVendedor(ctx.tenant.id, { nome: "Rep B", comissaoPercentual: 2 });
  const outroCliente = await seedCliente(ctx.tenant.id, {
    vendedorId: outroVendedor.id,
    cnpj: "33444555000103",
    razaoSocial: "Cliente B LTDA",
    nomeFantasia: "Cliente B",
  });
  const outroProduto = await seedProduto(ctx.tenant.id, { nome: "Cal Hidratada", unidade: "saco", codigo: "CH2" });
  await agent.post("/api/vendas").send({
    clienteId: outroCliente.id,
    vendedorId: outroVendedor.id,
    itens: [{ produtoId: outroProduto.id, quantidade: 3, precoUnitario: 50 }],
  });

  const soPeriodo = await agent.get("/api/relatorios/vendas").query({
    dataInicio: "2000-01-01",
    dataFim: "2100-01-01",
  });
  assert.equal(soPeriodo.body.totalRegistros, 2);
  assert.equal(soPeriodo.body.totalFaturamento, 350);

  const soRep = await agent.get("/api/relatorios/vendas").query({
    dataInicio: "2000-01-01",
    dataFim: "2100-01-01",
    vendedorId: ctx.vendedor.id,
  });
  assert.equal(soRep.body.totalFaturamento, 200);
  assert.equal(soRep.body.resumoRepresentantes.length, 1);

  const soCli = await agent.get("/api/relatorios/vendas").query({
    dataInicio: "2000-01-01",
    dataFim: "2100-01-01",
    clienteId: outroCliente.id,
  });
  assert.equal(soCli.body.totalFaturamento, 150);
  assert.equal(soCli.body.resumoClientes[0].clienteNome, "Cliente B");

  const soProd = await agent.get("/api/relatorios/vendas").query({
    dataInicio: "2000-01-01",
    dataFim: "2100-01-01",
    produtoId: outroProduto.id,
  });
  assert.equal(soProd.body.totalFaturamento, 150);
  assert.equal(soProd.body.resumoProdutos.length, 1);
  assert.equal(soProd.body.resumoProdutos[0].produtoNome, "Cal Hidratada");

  const multi = await agent.get("/api/relatorios/vendas").query({
    dataInicio: "2000-01-01",
    dataFim: "2100-01-01",
    vendedorId: outroVendedor.id,
    clienteId: outroCliente.id,
    produtoId: outroProduto.id,
  });
  assert.equal(multi.body.totalRegistros, 1);
  assert.equal(multi.body.totalFaturamento, 150);
  const fatEvo = multi.body.evolucao.pontos.reduce((acc, p) => acc + p.faturamento, 0);
  assert.equal(fatEvo, 150);

  const vazio = await agent.get("/api/relatorios/vendas").query({
    dataInicio: "1990-01-01",
    dataFim: "1990-01-02",
  });
  assert.equal(vazio.body.totalRegistros, 0);
  assert.equal(vazio.body.totalFaturamento, 0);
  assert.equal(vazio.body.resumoRepresentantes.length, 0);
  const qtdEvoVazio = vazio.body.evolucao.pontos.reduce((acc, p) => acc + p.quantidade, 0);
  assert.equal(qtdEvoVazio, 0);
});

test("GET /api/relatorios/vendas somenteDetalhes respeita os mesmos filtros e tenant", async () => {
  await criarVenda();
  const detalhe = await agent.get("/api/relatorios/vendas").query({
    somenteDetalhes: "true",
    dataInicio: "1990-01-01",
    dataFim: "1990-01-02",
  });
  assert.equal(detalhe.status, 200);
  assert.equal(detalhe.body.vendas.length, 0);
  assert.equal(detalhe.body.totalRegistros, 0);
  assert.equal(detalhe.body.resumoRepresentantes, undefined);
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
  const auditAjuste = await prisma.financeiroEvento.findFirst({
    where: { tipo: "COMISSAO_AJUSTE_LOTE" },
  });
  assert.ok(auditAjuste);

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
  assert.equal(res.body.totalOriginal, 200);
  assert.equal(res.body.totalPago, 0);
  assert.ok(res.body.faixas);
  assert.ok(Number.isFinite(res.body.totalVencido));
  assert.ok(Number.isFinite(res.body.totalAVencer));
  assert.ok(
    Math.abs(res.body.totalVencido + res.body.totalAVencer - res.body.totalEmAberto) < 0.02,
  );
  const row = res.body.clientesDevedores[0];
  assert.equal(row.titulosAbertos, 1);
  assert.ok(Math.abs(row.participacao - 100) < 0.02);
  assert.ok(Number.isFinite(row.maiorAtrasoDias));
});

test("GET /api/relatorios/financeiro ordena por titulos e atraso", async () => {
  await criarVenda();
  const porTitulos = await agent.get("/api/relatorios/financeiro").query({ ordenar: "titulos" });
  assert.equal(porTitulos.status, 200);
  assert.equal(porTitulos.body.clientesDevedores[0].titulosAbertos, 1);
  const porAtraso = await agent.get("/api/relatorios/financeiro").query({ ordenar: "atraso" });
  assert.equal(porAtraso.status, 200);
  assert.equal(porAtraso.body.clientesDevedores.length, 1);
});

test("GET /api/relatorios/financeiro e titulos filtram por representante", async () => {
  const outroVend = await seedVendedor(ctx.tenant.id, { nome: "Outro Rep" });
  const outroCli = await seedCliente(ctx.tenant.id, {
    vendedorId: outroVend.id,
    cnpj: "22333444000181",
    razaoSocial: "Cliente Outro LTDA",
    nomeFantasia: "Cliente Outro",
  });
  await criarVenda();
  await criarVenda({
    clienteId: outroCli.id,
    vendedorId: outroVend.id,
  });

  const titulos = await agent.get("/api/relatorios/titulos").query({
    vendedorId: ctx.vendedor.id,
    somenteEmAberto: "true",
  });
  assert.equal(titulos.status, 200);
  assert.equal(titulos.body.titulos.length, 1);
  assert.equal(titulos.body.titulos[0].cliente.id, ctx.cliente.id);

  const fin = await agent.get("/api/relatorios/financeiro").query({
    vendedorId: ctx.vendedor.id,
  });
  assert.equal(fin.status, 200);
  assert.equal(fin.body.clientesDevedores.length, 1);
  assert.equal(fin.body.clientesDevedores[0].cliente.id, ctx.cliente.id);
  assert.equal(fin.body.totalEmAberto, 200);

  const outro = await agent.get("/api/relatorios/financeiro").query({
    vendedorId: outroVend.id,
  });
  assert.equal(outro.status, 200);
  assert.equal(outro.body.clientesDevedores.length, 1);
  assert.equal(outro.body.totalEmAberto, 200);
});

test("GET /api/relatorios/titulos com faixas de vencimento", async () => {
  await criarVenda();
  const res = await agent.get("/api/relatorios/titulos");
  assert.equal(res.status, 200);
  assert.equal(res.body.titulos.length, 1);
  assert.ok(res.body.resumo.faixas);
  assert.equal(res.body.resumo.valorEmAberto, 200);
  assert.ok(Number.isFinite(res.body.resumo.totalVencido));
  assert.ok(Number.isFinite(res.body.resumo.totalAVencer));
  assert.ok(Number.isFinite(res.body.titulos[0].diasAtraso));
  assert.ok(Number.isFinite(res.body.titulos[0].diasAteVencer));
  assert.equal(typeof res.body.titulos[0].venceHoje, "boolean");
  assert.ok(
    Math.abs(
      res.body.resumo.totalVencido +
        res.body.resumo.totalAVencer -
        res.body.resumo.valorEmAberto,
    ) < 0.02,
  );

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

test("GET /api/relatorios/titulos filtra situacao vencidos e a vencer", async () => {
  const venda = await criarVenda();
  const aVencer = await agent.get("/api/relatorios/titulos").query({
    somenteEmAberto: "true",
    situacao: "a_vencer",
  });
  assert.equal(aVencer.status, 200);
  assert.equal(aVencer.body.titulos.length, 1);

  const vencidosAntes = await agent.get("/api/relatorios/titulos").query({
    somenteEmAberto: "true",
    situacao: "vencidos",
  });
  assert.equal(vencidosAntes.status, 200);
  assert.equal(vencidosAntes.body.titulos.length, 0);

  await prisma.tituloReceber.updateMany({
    where: { vendaId: venda.id, tenantId: ctx.tenant.id },
    data: { vencimento: new Date("2020-01-01T12:00:00.000Z") },
  });

  const vencidos = await agent.get("/api/relatorios/titulos").query({
    somenteEmAberto: "true",
    situacao: "vencidos",
  });
  assert.equal(vencidos.status, 200);
  assert.equal(vencidos.body.titulos.length, 1);
  assert.ok(vencidos.body.titulos[0].diasAtraso > 0);
  assert.equal(vencidos.body.resumo.valorEmAberto, 200);
  assert.equal(vencidos.body.resumo.totalVencido, 200);
  assert.equal(vencidos.body.resumo.totalAVencer, 0);
});

test("GET /api/relatorios/titulos pagamento parcial e título quitado", async () => {
  const venda = await criarVenda();
  const pg = await agent.post("/api/pagamentos").send({
    clienteId: ctx.cliente.id,
    vendaId: venda.id,
    valor: 50,
    tipo: "dinheiro",
  });
  assert.equal(pg.status, 201);

  const parcial = await agent.get("/api/relatorios/titulos").query({
    somenteEmAberto: "true",
    vendaId: String(venda.numeroVenda || venda.id),
  });
  assert.equal(parcial.status, 200);
  assert.equal(parcial.body.titulos.length, 1);
  assert.equal(parcial.body.titulos[0].status, "parcial");
  assert.equal(parcial.body.resumo.valorPago, 50);
  assert.equal(parcial.body.resumo.valorEmAberto, 150);

  const resto = await agent.post("/api/pagamentos").send({
    clienteId: ctx.cliente.id,
    vendaId: venda.id,
    valor: 150,
    tipo: "dinheiro",
  });
  assert.equal(resto.status, 201);

  const abertos = await agent.get("/api/relatorios/titulos").query({ somenteEmAberto: "true" });
  assert.equal(abertos.body.titulos.length, 0);
  assert.equal(abertos.body.resumo.valorEmAberto, 0);

  const todos = await agent.get("/api/relatorios/titulos").query({ status: "quitado" });
  assert.equal(todos.status, 200);
  assert.ok(todos.body.titulos.length >= 1);
  assert.equal(todos.body.titulos[0].status, "quitado");

  const fin = await agent.get("/api/relatorios/financeiro");
  assert.equal(fin.status, 200);
  assert.equal(fin.body.clientesDevedores.length, 0);
  assert.equal(fin.body.totalEmAberto, 0);
});

test("GET /api/relatorios/titulos cheque abate o saldo uma vez", async () => {
  const venda = await criarVenda();
  const cheque = await agent.post("/api/cheques").send({
    clienteId: ctx.cliente.id,
    vendaId: venda.id,
    valor: 80,
    banco: "Sicredi",
    numero: "1001",
    emitenteNome: "Cliente Teste",
  });
  assert.equal(cheque.status, 201);

  const tit = await agent.get("/api/relatorios/titulos").query({ somenteEmAberto: "true" });
  assert.equal(tit.status, 200);
  assert.equal(tit.body.resumo.valorPago, 80);
  assert.equal(tit.body.resumo.valorEmAberto, 120);

  const fin = await agent.get("/api/relatorios/financeiro");
  assert.equal(fin.body.totalPago, 80);
  assert.equal(fin.body.totalEmAberto, 120);
});

test("GET /api/relatorios/titulos vazio e não vaza cliente de outro tenant", async () => {
  const vazio = await agent.get("/api/relatorios/titulos");
  assert.equal(vazio.status, 200);
  assert.equal(vazio.body.titulos.length, 0);
  assert.equal(vazio.body.resumo.valorEmAberto, 0);

  const outro = await seedTenant({ slug: "requinte", name: "Requinte" });
  const outroVend = await seedVendedor(outro.id, { nome: "Rep Outro Tenant" });
  const outroCli = await seedCliente(outro.id, {
    vendedorId: outroVend.id,
    cnpj: "99888777000166",
    razaoSocial: "Outro Tenant LTDA",
    nomeFantasia: "Outro Tenant",
  });
  await criarVenda();
  const vazou = await agent.get("/api/relatorios/titulos").query({
    clienteId: outroCli.id,
    somenteEmAberto: "true",
  });
  assert.equal(vazou.status, 200);
  assert.equal(vazou.body.titulos.length, 0);

  const fin = await agent.get("/api/relatorios/financeiro").query({ busca: "Outro Tenant" });
  assert.equal(fin.status, 200);
  assert.equal(fin.body.clientesDevedores.length, 0);
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
  assert.match(dl.text, /Frete pago/);
});

test("export-async de financeiro e titulos", async () => {
  await criarVenda();
  const fin = await agent.post("/api/relatorios/financeiro/export-async").send({});
  const finJob = await waitJob(fin.body.jobId);
  assert.equal(finJob.status, "completed");
  const finDl = await agent.get(`/api/relatorios/exports/${fin.body.jobId}/download`);
  assert.equal(finDl.status, 200);
  assert.match(finDl.text, /Original \(titulos\)/);
  assert.match(finDl.text, /Pago \(titulos\)/);
  assert.match(finDl.text, /Em aberto \(titulos\)/);
  assert.doesNotMatch(finDl.text, /Debitos,Pagamentos/);

  const tit = await agent.post("/api/relatorios/titulos/export-async").send({ somenteEmAberto: true });
  const titJob = await waitJob(tit.body.jobId);
  assert.equal(titJob.status, "completed");
  const dl = await agent.get(`/api/relatorios/exports/${tit.body.jobId}/download`);
  assert.equal(dl.status, 200);
  assert.match(dl.text, /Valor Original/);
  assert.match(dl.text, /Valor Pago/);
  assert.match(dl.text, /Valor em Aberto/);
});

test("exports/:jobId 404 e download antes de concluir 409", async () => {
  const missing = await agent.get("/api/relatorios/exports/nao-existe");
  assert.equal(missing.status, 404);
  const dlMissing = await agent.get("/api/relatorios/exports/nao-existe/download");
  assert.equal(dlMissing.status, 404);
});
