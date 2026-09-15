const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const AdmZip = require("adm-zip");
const ExcelJS = require("exceljs");
const {
  agent,
  prisma,
  resetDb,
  seedBase,
} = require("../helpers/testServer");
const { STATUS } = require("../../src/domain/nfe/constants");
const { getExportJob, exportJobBelongsToTenant } = require("../../src/services/exportJobs");
const { processNfePacoteContabil } = require("../../src/services/fiscal/nfePacoteContabil");
const { detectarLacunasNumeracao } = require("../../src/domain/fiscal/lacunasNumeracao");

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
  process.env.NFE_PROVIDER = "mock";
  process.env.DEFAULT_TENANT_ID = "1";
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
    cliente: { ...fiscalCliente, ...(opts.cliente || {}) },
    produto: fiscalProduto,
  });
  await prisma.emitenteFiscal.create({
    data: {
      tenantId: base.tenant.id,
      ...emitenteBody,
      ...(opts.emitente || {}),
      cnpj: opts.emitente?.cnpj || (opts.tenant?.slug === "outro" ? "22333444000199" : emitenteBody.cnpj),
    },
  });
  await enableNfe(base.tenant.id);
  return base;
}

async function nextNumeroVenda(tenantId) {
  const last = await prisma.venda.findFirst({
    where: { tenantId },
    orderBy: { numeroVenda: "desc" },
    select: { numeroVenda: true },
  });
  return (last?.numeroVenda || 0) + 1;
}

async function criarVendaComNota(base, notaOver = {}) {
  const valor = notaOver.valorTotal ?? 100;
  const venda = await prisma.venda.create({
    data: {
      tenantId: base.tenant.id,
      numeroVenda: notaOver.numeroVenda || (await nextNumeroVenda(base.tenant.id)),
      clienteId: base.cliente.id,
      vendedorId: base.vendedor.id,
      valorTotal: valor,
      dataVenda: notaOver.dataVenda || new Date("2026-09-10T15:00:00"),
      itens: {
        create: [
          {
            produtoId: base.produto.id,
            quantidade: 1,
            precoUnitario: valor,
            subtotal: valor,
          },
        ],
      },
    },
  });
  const status = notaOver.status || STATUS.AUTORIZADA;
  const nota = await prisma.notaFiscal.create({
    data: {
      tenantId: base.tenant.id,
      vendaId: venda.id,
      status,
      serie: notaOver.serie ?? 1,
      numero: notaOver.numero ?? null,
      chaveAcesso:
        notaOver.chaveAcesso !== undefined
          ? notaOver.chaveAcesso
          : "35260911222333000181550010000001251000001250",
      protocolo: notaOver.protocolo ?? "prot-1",
      motivoRejeicao: notaOver.motivoRejeicao ?? null,
      xmlUrl: notaOver.xmlUrl !== undefined ? notaOver.xmlUrl : null,
      danfeUrl: notaOver.danfeUrl !== undefined ? notaOver.danfeUrl : null,
      refProvedor: notaOver.refProvedor || `venda-${base.tenant.id}-${venda.id}`,
      emitidaEm: notaOver.emitidaEm || new Date("2026-09-10T15:00:00"),
      autorizadaEm:
        notaOver.autorizadaEm !== undefined
          ? notaOver.autorizadaEm
          : status === STATUS.AUTORIZADA
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
            valor_bruto: String(Number(valor).toFixed(2)),
          },
        ],
      },
    },
  });
  return { venda, nota };
}

async function waitJob(jobId, attempts = 50) {
  let job = null;
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, 40));
    job = await getExportJob(jobId);
    if (job?.status === "completed" || job?.status === "failed") break;
  }
  return job;
}

async function createMember(tenantId, { email, navPermissions }) {
  const hash = await bcrypt.hash("segredo123", 4);
  return prisma.user.create({
    data: {
      tenantId,
      email,
      passwordHash: hash,
      name: email,
      role: "member",
      navPermissions,
    },
  });
}

test("archiver instalado é 7.0.1 com API função", () => {
  const pkg = require("../../package.json");
  const installed = require("archiver/package.json");
  const archiver = require("archiver");
  assert.equal(pkg.dependencies.archiver, "7.0.1");
  assert.equal(installed.version, "7.0.1");
  assert.equal(typeof archiver, "function");
});

test("STATUS não persiste EMISSAO_INCERTA", () => {
  assert.equal(STATUS.EMISSAO_INCERTA, undefined);
  assert.deepEqual(
    Object.values(STATUS).sort(),
    ["autorizada", "cancelada", "denegada", "processando", "rascunho", "rejeitada"].sort(),
  );
});

test("cálculo fiscal: valor autorizado só de autorizada (100)", async () => {
  const base = await seedFiscalTenant();
  await criarVendaComNota(base, { numero: 1, valorTotal: 100, status: STATUS.AUTORIZADA });
  await criarVendaComNota(base, {
    numero: 2,
    valorTotal: 200,
    status: STATUS.CANCELADA,
    autorizadaEm: new Date("2026-09-11T10:00:00"),
    canceladaEm: new Date("2026-09-12T10:00:00"),
  });
  await criarVendaComNota(base, {
    numero: 3,
    valorTotal: 300,
    status: STATUS.REJEITADA,
    autorizadaEm: null,
    motivoRejeicao: "Rejeição SEFAZ",
  });
  await criarVendaComNota(base, {
    numero: null,
    valorTotal: 400,
    status: STATUS.PROCESSANDO,
    autorizadaEm: null,
    chaveAcesso: null,
  });

  const res = await agent
    .get("/api/fiscal/notas/resumo")
    .query({ dataInicio: "2026-09-01", dataFim: "2026-09-30" });
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 4);
  assert.equal(res.body.autorizadas, 1);
  assert.equal(res.body.canceladas, 1);
  assert.equal(res.body.rejeitadas, 1);
  assert.equal(res.body.processando, 1);
  assert.equal(res.body.emissaoIncerta, 0);
  assert.equal(res.body.valorAutorizado, 100);
  assert.match(res.body.observacaoEmissaoIncerta, /Processando/i);
  assert.equal(res.body.ambiente, "homologacao");
});

test("lacunas 100/101/103/105 → 102 e 104 como possível lacuna", () => {
  const lacunas = detectarLacunasNumeracao([
    { serie: 1, numero: 100 },
    { serie: 1, numero: 101 },
    { serie: 1, numero: 103 },
    { serie: 1, numero: 105 },
  ]);
  assert.equal(lacunas.length, 1);
  assert.deepEqual(lacunas[0].numerosAusentes, [102, 104]);
  assert.equal(lacunas[0].label, "Possível lacuna de numeração");
  assert.doesNotMatch(lacunas[0].label, /erro fiscal/i);
});

test("fechamento homologação + lacunas sem texto de erro fiscal", async () => {
  const base = await seedFiscalTenant();
  for (const n of [100, 101, 103, 105]) {
    await criarVendaComNota(base, { numero: n });
  }
  const res = await agent
    .get("/api/fiscal/fechamento")
    .query({ dataInicio: "2026-09-01", dataFim: "2026-09-30", tenantId: 999 })
    .send();
  assert.equal(res.status, 200);
  assert.equal(res.body.ambiente, "homologacao");
  assert.deepEqual(res.body.lacunas[0].numerosAusentes, [102, 104]);
  const blob = JSON.stringify(res.body);
  assert.doesNotMatch(blob, /erro fiscal/i);
  assert.match(res.body.disclaimer, /contabilidade/i);
});

test("detalhe e resumo expõem ambiente de homologação", async () => {
  const base = await seedFiscalTenant();
  const { nota } = await criarVendaComNota(base, { numero: 50 });
  const det = await agent.get(`/api/fiscal/notas/${nota.id}`);
  assert.equal(det.status, 200);
  assert.equal(det.body.ambiente, "homologacao");
  const resumo = await agent
    .get("/api/fiscal/notas/resumo")
    .query({ dataInicio: "2026-09-01", dataFim: "2026-09-30" });
  assert.equal(resumo.body.ambiente, "homologacao");
});

test("ACL: com fiscal=200; sem fiscal=403 (nfe ligado)", async () => {
  const base = await seedFiscalTenant();
  await createMember(base.tenant.id, {
    email: "com-fiscal@local",
    navPermissions: ["fiscal", "vendas"],
  });
  await createMember(base.tenant.id, {
    email: "sem-fiscal@local",
    navPermissions: ["vendas", "clientes"],
  });

  const prev = process.env.AUTH_DISABLED;
  process.env.AUTH_DISABLED = "false";
  try {
    const okLogin = await agent
      .post("/api/auth/login")
      .send({ email: "com-fiscal@local", password: "segredo123" });
    assert.equal(okLogin.status, 200);
    const ok = await agent
      .get("/api/fiscal/fechamento")
      .query({ dataInicio: "2026-09-01", dataFim: "2026-09-30" })
      .set("Authorization", `Bearer ${okLogin.body.token}`);
    assert.equal(ok.status, 200);

    const noLogin = await agent
      .post("/api/auth/login")
      .send({ email: "sem-fiscal@local", password: "segredo123" });
    assert.equal(noLogin.status, 200);
    const paths = [
      "/api/fiscal/notas",
      "/api/fiscal/notas/resumo",
      "/api/fiscal/fechamento",
      "/api/fiscal/fechamento/export",
    ];
    for (const p of paths) {
      const r = await agent
        .get(p)
        .query({ dataInicio: "2026-09-01", dataFim: "2026-09-30" })
        .set("Authorization", `Bearer ${noLogin.body.token}`);
      assert.equal(r.status, 403, p);
    }
    const pacote = await agent
      .post("/api/fiscal/fechamento/pacote")
      .send({ dataInicio: "2026-09-01", dataFim: "2026-09-30" })
      .set("Authorization", `Bearer ${noLogin.body.token}`);
    assert.equal(pacote.status, 403);
  } finally {
    process.env.AUTH_DISABLED = prev;
  }
});

test("isolamento completo A vs B + ignore tenantId no request + job", async () => {
  const a = await seedFiscalTenant({ tenant: { slug: "default", name: "A" } });
  const b = await seedFiscalTenant({
    tenant: { slug: "outro", name: "B" },
    cliente: { cnpj: "22333444000199", razaoSocial: "Cliente B" },
  });
  assert.equal(a.tenant.id, 1);

  const { nota: notaA } = await criarVendaComNota(a, { numero: 10, valorTotal: 111 });
  const { nota: notaB } = await criarVendaComNota(b, {
    numero: 99,
    valorTotal: 9999,
    chaveAcesso: "35260922333444000199550010000000991000009990",
  });

  // Query com tenantId arbitrário não vazia dados do B
  const lista = await agent.get("/api/fiscal/notas").query({
    dataInicio: "2026-09-01",
    dataFim: "2026-09-30",
    tenantId: b.tenant.id,
  });
  assert.equal(lista.status, 200);
  assert.equal(lista.body.items.length, 1);
  assert.equal(lista.body.items[0].id, notaA.id);

  const detalheB = await agent
    .get(`/api/fiscal/notas/${notaB.id}`)
    .query({ tenantId: b.tenant.id });
  assert.equal(detalheB.status, 404);

  const xmlB = await agent.get(`/api/fiscal/notas/${notaB.id}/xml`);
  assert.equal(xmlB.status, 404);
  const danfeB = await agent.get(`/api/fiscal/notas/${notaB.id}/danfe`);
  assert.equal(danfeB.status, 404);

  const fech = await agent.get("/api/fiscal/fechamento").query({
    dataInicio: "2026-09-01",
    dataFim: "2026-09-30",
    tenantId: String(b.tenant.id),
  });
  assert.equal(fech.status, 200);
  assert.equal(fech.body.resumo.valorAutorizado, 111);

  const exp = await agent.get("/api/fiscal/fechamento/export").query({
    dataInicio: "2026-09-01",
    dataFim: "2026-09-30",
    tenantId: b.tenant.id,
  });
  assert.equal(exp.status, 200);
  assert.equal(exp.body.rows.length, 1);
  assert.equal(exp.body.rows[0].Valor, 111);

  // Job do tenant B não pode ser baixado pelo tenant A (DEFAULT=1)
  const jobB = await processNfePacoteContabil(
    { dataInicio: "2026-09-01", dataFim: "2026-09-30", tenantId: a.tenant.id },
    b.tenant.id,
  );
  assert.equal(jobB.totalLinhas, 1);
  // Conteúdo do job processado com tenant B não inclui nota A
  const zipB = new AdmZip(Buffer.from(jobB.content, "base64"));
  const readmeB = zipB.readAsText(zipB.getEntries().find((e) => e.entryName.endsWith("README.txt")));
  assert.match(readmeB, /NF-e autorizadas: 1/);

  const startA = await agent
    .post("/api/fiscal/fechamento/pacote")
    .send({
      dataInicio: "2026-09-01",
      dataFim: "2026-09-30",
      tenantId: b.tenant.id,
    });
  assert.equal(startA.status, 202);
  const jobA = await waitJob(startA.body.jobId);
  assert.equal(jobA.status, "completed", jobA?.error);
  assert.equal(jobA.tenantId, 1);
  assert.equal(exportJobBelongsToTenant(jobA, 1), true);
  assert.equal(exportJobBelongsToTenant(jobA, b.tenant.id), false);

  const dl = await agent.get(`/api/relatorios/exports/${startA.body.jobId}/download`);
  assert.equal(dl.status, 200);
});

test("ZIP mock: estrutura, XLSX, README, XML; sem XML falso fora do mock", async () => {
  const base = await seedFiscalTenant();
  await criarVendaComNota(base, { numero: 125, valorTotal: 2500, status: STATUS.AUTORIZADA });
  await criarVendaComNota(base, {
    numero: 126,
    valorTotal: 800,
    status: STATUS.CANCELADA,
    autorizadaEm: new Date("2026-09-11T10:00:00"),
    canceladaEm: new Date("2026-09-12T10:00:00"),
  });
  await criarVendaComNota(base, {
    numero: 127,
    valorTotal: 50,
    status: STATUS.REJEITADA,
    autorizadaEm: null,
  });

  process.env.NFE_PROVIDER = "mock";
  const resultMock = await processNfePacoteContabil(
    { dataInicio: "2026-09-01", dataFim: "2026-09-30" },
    base.tenant.id,
  );
  const zip = new AdmZip(Buffer.from(resultMock.content, "base64"));
  const names = zip.getEntries().map((e) => e.entryName.replace(/\\/g, "/"));
  assert.ok(names.some((n) => n.endsWith("relatorio-nfe.xlsx")), names.join("\n"));
  assert.ok(names.some((n) => n.endsWith("README.txt")), names.join("\n"));
  assert.ok(names.some((n) => n.includes("/xml/nfe-125.xml")), names.join("\n"));
  assert.ok(names.some((n) => n.includes("/canceladas/nfe-126.xml")), names.join("\n"));
  assert.ok(
    names.some((n) => n.includes("/canceladas/eventos/resumo-cancelamentos.txt")),
    names.join("\n"),
  );

  const readme = zip.readAsText(zip.getEntries().find((e) => e.entryName.endsWith("README.txt")));
  assert.match(readme, /HOMOLOGAÇÃO/);
  assert.match(readme, /NF-e autorizadas: 1/);
  assert.match(readme, /contabilidade/i);

  const xlsxEntry = zip.getEntries().find((e) => e.entryName.endsWith("relatorio-nfe.xlsx"));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsxEntry.getData());
  const sheet = wb.getWorksheet("NF-e");
  assert.ok(sheet);
  assert.ok(sheet.rowCount >= 2);

  // Fora do mock e sem xmlUrl: não inventa XML
  process.env.NFE_PROVIDER = "focusnfe";
  const resultProd = await processNfePacoteContabil(
    { dataInicio: "2026-09-01", dataFim: "2026-09-30" },
    base.tenant.id,
  );
  const zipProd = new AdmZip(Buffer.from(resultProd.content, "base64"));
  const namesProd = zipProd.getEntries().map((e) => e.entryName.replace(/\\/g, "/"));
  assert.ok(!namesProd.some((n) => n.includes("/xml/")), namesProd.join("\n"));
  const readmeProd = zipProd.readAsText(
    zipProd.getEntries().find((e) => e.entryName.endsWith("README.txt")),
  );
  assert.match(readmeProd, /XMLs indisponíveis \(não incluídos\):/);
  process.env.NFE_PROVIDER = "mock";
});

test("XML/DANFE disponíveis via mock; indisponível para rejeitada", async () => {
  const base = await seedFiscalTenant();
  const { nota: ok } = await criarVendaComNota(base, {
    numero: 10,
    status: STATUS.AUTORIZADA,
  });
  const { nota: rej } = await criarVendaComNota(base, {
    numero: 11,
    status: STATUS.REJEITADA,
    autorizadaEm: null,
    chaveAcesso: null,
  });

  const xmlOk = await agent.get(`/api/fiscal/notas/${ok.id}/xml`);
  assert.equal(xmlOk.status, 200);
  assert.match(String(xmlOk.text || xmlOk.body), /nfeProc|NFe/);

  const danfeOk = await agent.get(`/api/fiscal/notas/${ok.id}/danfe`);
  assert.equal(danfeOk.status, 200);

  const xmlRej = await agent.get(`/api/fiscal/notas/${rej.id}/xml`);
  assert.equal(xmlRej.status, 404);
  assert.match(String(xmlRej.body?.error || ""), /não disponível/i);

  const danfeRej = await agent.get(`/api/fiscal/notas/${rej.id}/danfe`);
  assert.equal(danfeRej.status, 404);
});
