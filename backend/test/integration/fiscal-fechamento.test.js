const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const {
  agent,
  prisma,
  resetDb,
  seedBase,
} = require("../helpers/testServer");
const { STATUS } = require("../../src/domain/nfe/constants");
const { getExportJob } = require("../../src/services/exportJobs");

process.env.NFE_PROVIDER = "mock";

const fiscalCliente = {
  cidade: "Campinas",
  estado: "SP",
  endereco: "Av. Brasil",
  numero: "100",
  bairro: "Centro",
  cep: "13000000",
  codigoMunicipio: "3509502",
  inscricaoEstadual: "ISENTO",
  indIEDest: 2,
};

const fiscalProduto = {
  ncm: "25221000",
  cfopPadraoDentro: "5102",
  cfopPadraoFora: "6102",
  csosn: "102",
  origem: 0,
};

const emitenteBody = {
  cnpj: "11222333000181",
  inscricaoEstadual: "123456789",
  razaoSocial: "Colombocal LTDA",
  nomeFantasia: "Colombocal",
  crt: 1,
  logradouro: "Rua da Cal",
  numero: "10",
  bairro: "Centro",
  municipio: "Limeira",
  codigoMunicipio: "3526902",
  uf: "SP",
  cep: "13480000",
  ambiente: "homologacao",
  modalidadeFrete: 9,
};

test.beforeEach(async () => {
  await resetDb();
});

async function enableNfe(tenantId) {
  await prisma.configSistema.upsert({
    where: { tenantId_chave: { tenantId, chave: "NFE_ENABLED" } },
    create: { tenantId, chave: "NFE_ENABLED", valor: "true" },
    update: { valor: "true" },
  });
}

async function seedFiscalTenant(opts = {}) {
  const base = await seedBase({
    tenant: opts.tenant || { slug: "default", name: "Colombocal" },
    cliente: fiscalCliente,
    produto: fiscalProduto,
  });
  await prisma.emitenteFiscal.create({
    data: { tenantId: base.tenant.id, ...emitenteBody },
  });
  await enableNfe(base.tenant.id);
  return base;
}

async function criarVendaComNota(base, notaOver = {}) {
  const venda = await prisma.venda.create({
    data: {
      tenantId: base.tenant.id,
      numeroVenda: notaOver.numeroVenda || (await nextNumeroVenda(base.tenant.id)),
      clienteId: base.cliente.id,
      vendedorId: base.vendedor.id,
      valorTotal: notaOver.valorTotal ?? 2500,
      dataVenda: notaOver.dataVenda || new Date("2026-09-10T15:00:00"),
      itens: {
        create: [
          {
            produtoId: base.produto.id,
            quantidade: 1,
            precoUnitario: notaOver.valorTotal ?? 2500,
            subtotal: notaOver.valorTotal ?? 2500,
          },
        ],
      },
    },
  });
  const nota = await prisma.notaFiscal.create({
    data: {
      tenantId: base.tenant.id,
      vendaId: venda.id,
      status: notaOver.status || STATUS.AUTORIZADA,
      serie: notaOver.serie ?? 1,
      numero: notaOver.numero ?? 125,
      chaveAcesso: notaOver.chaveAcesso ?? "35260911222333000181550010000001251000001250",
      protocolo: notaOver.protocolo ?? "prot-1",
      motivoRejeicao: notaOver.motivoRejeicao ?? null,
      refProvedor: notaOver.refProvedor || `venda-${base.tenant.id}-${venda.id}`,
      emitidaEm: notaOver.emitidaEm || new Date("2026-09-10T15:00:00"),
      autorizadaEm:
        notaOver.autorizadaEm !== undefined
          ? notaOver.autorizadaEm
          : notaOver.status === STATUS.AUTORIZADA || !notaOver.status
            ? new Date("2026-09-10T15:05:00")
            : null,
      canceladaEm: notaOver.canceladaEm || null,
      payloadEnviado: notaOver.payloadEnviado || {
        items: [
          {
            numero_item: "1",
            codigo_produto: base.produto.codigo,
            descricao: base.produto.nome,
            cfop: "5102",
            codigo_ncm: "25221000",
            icms_situacao_tributaria: "102",
            valor_bruto: "2500.00",
          },
        ],
      },
    },
  });
  return { venda, nota };
}

async function nextNumeroVenda(tenantId) {
  const last = await prisma.venda.findFirst({
    where: { tenantId },
    orderBy: { numeroVenda: "desc" },
    select: { numeroVenda: true },
  });
  return (last?.numeroVenda || 0) + 1;
}

test("GET /api/fiscal/notas/resumo — status e valor autorizado", async () => {
  process.env.DEFAULT_TENANT_ID = "1";
  const base = await seedFiscalTenant();
  assert.equal(base.tenant.id, 1);

  await criarVendaComNota(base, { numero: 101, valorTotal: 1000, status: STATUS.AUTORIZADA });
  await criarVendaComNota(base, {
    numero: 102,
    valorTotal: 500,
    status: STATUS.CANCELADA,
    autorizadaEm: new Date("2026-09-11T10:00:00"),
    canceladaEm: new Date("2026-09-12T10:00:00"),
    emitidaEm: new Date("2026-09-11T10:00:00"),
  });
  await criarVendaComNota(base, {
    numero: 103,
    valorTotal: 300,
    status: STATUS.REJEITADA,
    autorizadaEm: null,
    emitidaEm: new Date("2026-09-12T10:00:00"),
    motivoRejeicao: "Cadastro incompleto",
  });
  await criarVendaComNota(base, {
    numero: null,
    valorTotal: 200,
    status: STATUS.PROCESSANDO,
    autorizadaEm: null,
    emitidaEm: new Date("2026-09-13T10:00:00"),
    chaveAcesso: null,
  });

  const res = await agent
    .get("/api/fiscal/notas/resumo")
    .query({ dataInicio: "2026-09-01", dataFim: "2026-09-30" });
  assert.equal(res.status, 200);
  assert.equal(res.body.autorizadas, 1);
  assert.equal(res.body.canceladas, 1);
  assert.equal(res.body.rejeitadas, 1);
  assert.equal(res.body.processando, 1);
  assert.equal(res.body.emissaoIncerta, 0);
  assert.equal(res.body.valorAutorizado, 1000);
  assert.ok(res.body.observacaoEmissaoIncerta);
});

test("isolamento: tenant A não vê NF-e do tenant B", async () => {
  process.env.DEFAULT_TENANT_ID = "1";
  const a = await seedFiscalTenant({ tenant: { slug: "default", name: "A" } });
  const b = await seedFiscalTenant({ tenant: { slug: "outro", name: "B" } });
  assert.equal(a.tenant.id, 1);
  assert.ok(b.tenant.id !== 1);

  await criarVendaComNota(a, { numero: 10, valorTotal: 100 });
  const { nota: notaB } = await criarVendaComNota(b, {
    numero: 99,
    valorTotal: 9999,
    chaveAcesso: "35260911222333000181550010000000991000009990",
  });

  const lista = await agent
    .get("/api/fiscal/notas")
    .query({ dataInicio: "2026-09-01", dataFim: "2026-09-30" });
  assert.equal(lista.status, 200);
  assert.equal(lista.body.items.length, 1);
  assert.equal(lista.body.items[0].numero, 10);

  const detalhe = await agent.get(`/api/fiscal/notas/${notaB.id}`);
  assert.equal(detalhe.status, 404);

  const xml = await agent.get(`/api/fiscal/notas/${notaB.id}/xml`);
  assert.equal(xml.status, 404);

  const fech = await agent
    .get("/api/fiscal/fechamento")
    .query({ dataInicio: "2026-09-01", dataFim: "2026-09-30" });
  assert.equal(fech.status, 200);
  assert.equal(fech.body.resumo.autorizadas, 1);
  assert.equal(fech.body.resumo.valorAutorizado, 100);
});

test("fechamento detecta possível lacuna e lista canceladas/rejeitadas", async () => {
  process.env.DEFAULT_TENANT_ID = "1";
  const base = await seedFiscalTenant();
  await criarVendaComNota(base, { numero: 101 });
  await criarVendaComNota(base, { numero: 102 });
  await criarVendaComNota(base, { numero: 104 });
  await criarVendaComNota(base, {
    numero: 105,
    status: STATUS.CANCELADA,
    autorizadaEm: new Date("2026-09-15T10:00:00"),
    canceladaEm: new Date("2026-09-16T10:00:00"),
  });

  const res = await agent
    .get("/api/fiscal/fechamento")
    .query({ dataInicio: "2026-09-01", dataFim: "2026-09-30" });
  assert.equal(res.status, 200);
  assert.ok(res.body.disclaimer.includes("contabilidade"));
  assert.ok(res.body.lacunas.length >= 1);
  assert.ok(res.body.lacunas[0].numerosAusentes.includes(103));
  assert.equal(res.body.lacunas[0].label, "Possível lacuna de numeração");
  assert.equal(res.body.canceladas.length, 1);
});

test("export Excel JSON só do tenant e XML mock disponível", async () => {
  process.env.DEFAULT_TENANT_ID = "1";
  const base = await seedFiscalTenant();
  const { nota } = await criarVendaComNota(base, { numero: 125, valorTotal: 2500 });

  const exp = await agent
    .get("/api/fiscal/fechamento/export")
    .query({ dataInicio: "2026-09-01", dataFim: "2026-09-30" });
  assert.equal(exp.status, 200);
  assert.equal(exp.body.rows.length, 1);
  assert.equal(exp.body.rows[0].Número, 125);
  assert.equal(exp.body.rows[0].Valor, 2500);
  assert.equal(exp.body.rows[0].CFOP, "5102");

  const xml = await agent.get(`/api/fiscal/notas/${nota.id}/xml`);
  assert.equal(xml.status, 200);
  assert.match(String(xml.text || xml.body), /nfeProc|NFe/);
});

test("pacote contábil ZIP enfileira e completa com tenant do job", async () => {
  process.env.DEFAULT_TENANT_ID = "1";
  const base = await seedFiscalTenant();
  await criarVendaComNota(base, { numero: 200 });

  const start = await agent
    .post("/api/fiscal/fechamento/pacote")
    .send({ dataInicio: "2026-09-01", dataFim: "2026-09-30" });
  assert.equal(start.status, 202);
  assert.ok(start.body.jobId);

  let job = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 50));
    job = await getExportJob(start.body.jobId);
    if (job?.status === "completed" || job?.status === "failed") break;
  }
  assert.equal(job.status, "completed", job?.error);
  assert.equal(job.tenantId, 1);
  assert.equal(job.result.mimeType, "application/zip");
  assert.equal(job.result.encoding, "base64");
  assert.ok(Buffer.from(job.result.content, "base64").length > 100);

  const dl = await agent.get(`/api/relatorios/exports/${start.body.jobId}/download`);
  assert.equal(dl.status, 200);
  assert.match(dl.headers["content-type"], /zip/);
});

test("usuário sem permissão fiscal recebe 403", async () => {
  const base = await seedFiscalTenant();
  const hash = await bcrypt.hash("segredo123", 4);
  await prisma.user.create({
    data: {
      tenantId: base.tenant.id,
      email: "atendente@local",
      passwordHash: hash,
      name: "Atendente",
      role: "member",
      navPermissions: ["vendas", "clientes"],
    },
  });

  const prev = process.env.AUTH_DISABLED;
  process.env.AUTH_DISABLED = "false";
  try {
    const login = await agent
      .post("/api/auth/login")
      .send({ email: "atendente@local", password: "segredo123" });
    assert.equal(login.status, 200);
    const token = login.body.token;

    const res = await agent
      .get("/api/fiscal/notas")
      .query({ dataInicio: "2026-09-01", dataFim: "2026-09-30" })
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
  } finally {
    process.env.AUTH_DISABLED = prev;
  }
});

test("módulo nfe desligado bloqueia fiscal", async () => {
  process.env.DEFAULT_TENANT_ID = "1";
  await seedBase({ tenant: { slug: "default", name: "Colombocal" } });
  const res = await agent
    .get("/api/fiscal/notas")
    .query({ dataInicio: "2026-09-01", dataFim: "2026-09-30" });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, "NFE_DESABILITADA");
});
