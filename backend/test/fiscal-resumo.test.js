const test = require("node:test");
const assert = require("node:assert/strict");
const { resumoFiscal } = require("../src/domain/fiscal/resumoFiscal");
const { detectarLacunasNumeracao } = require("../src/domain/fiscal/lacunasNumeracao");
const { dataReferenciaNota } = require("../src/domain/fiscal/dataReferencia");
const { extrairItensFiscaisDoPayload, resumoFiscalLinha } = require("../src/domain/fiscal/extrairFiscal");
const { montarWhereNotas } = require("../src/domain/fiscal/montarWhereNotas");
const { STATUS } = require("../src/domain/nfe/constants");

test("resumoFiscal: autorizada entra no valor; demais status não", () => {
  const resumo = resumoFiscal([
    { status: STATUS.AUTORIZADA, venda: { valorTotal: 100 } },
    { status: STATUS.AUTORIZADA, venda: { valorTotal: 50.5 } },
    { status: STATUS.CANCELADA, venda: { valorTotal: 999 } },
    { status: STATUS.REJEITADA, venda: { valorTotal: 80 } },
    { status: STATUS.PROCESSANDO, venda: { valorTotal: 70 } },
    { status: STATUS.DENEGADA, venda: { valorTotal: 60 } },
  ]);
  assert.equal(resumo.total, 6);
  assert.equal(resumo.autorizadas, 2);
  assert.equal(resumo.canceladas, 1);
  assert.equal(resumo.rejeitadas, 1);
  assert.equal(resumo.processando, 1);
  assert.equal(resumo.denegadas, 1);
  assert.equal(resumo.emissaoIncerta, 0);
  assert.equal(resumo.valorAutorizado, 150.5);
});

test("detectarLacunasNumeracao: possível lacuna sem classificar como erro", () => {
  const lacunas = detectarLacunasNumeracao([
    { serie: 1, numero: 101 },
    { serie: 1, numero: 102 },
    { serie: 1, numero: 103 },
    { serie: 1, numero: 105 },
    { serie: 1, numero: 106 },
  ]);
  assert.equal(lacunas.length, 1);
  assert.equal(lacunas[0].serie, 1);
  assert.deepEqual(lacunas[0].numerosAusentes, [104]);
  assert.equal(lacunas[0].label, "Possível lacuna de numeração");
});

test("detectarLacunasNumeracao: sem lacuna", () => {
  assert.deepEqual(
    detectarLacunasNumeracao([
      { serie: 1, numero: 1 },
      { serie: 1, numero: 2 },
    ]),
    [],
  );
});

test("dataReferenciaNota: coalesce autorizadaEm → emitidaEm → createdAt", () => {
  const a = new Date("2026-09-10T12:00:00Z");
  const e = new Date("2026-09-09T12:00:00Z");
  const c = new Date("2026-09-08T12:00:00Z");
  assert.equal(dataReferenciaNota({ autorizadaEm: a, emitidaEm: e, createdAt: c }).getTime(), a.getTime());
  assert.equal(dataReferenciaNota({ autorizadaEm: null, emitidaEm: e, createdAt: c }).getTime(), e.getTime());
  assert.equal(dataReferenciaNota({ autorizadaEm: null, emitidaEm: null, createdAt: c }).getTime(), c.getTime());
});

test("extrairItensFiscaisDoPayload lê CFOP/NCM/CSOSN", () => {
  const itens = extrairItensFiscaisDoPayload({
    items: [
      {
        numero_item: "1",
        codigo_produto: "P1",
        descricao: "Cal",
        cfop: "5102",
        codigo_ncm: "25221000",
        icms_situacao_tributaria: "102",
      },
    ],
  });
  assert.equal(itens[0].cfop, "5102");
  assert.equal(itens[0].ncm, "25221000");
  assert.equal(itens[0].csosn, "102");
  const linha = resumoFiscalLinha({
    items: itens.map((i) => ({
      cfop: i.cfop,
      codigo_ncm: i.ncm,
      icms_situacao_tributaria: i.csosn,
    })),
  });
  assert.equal(linha.cfop, "5102");
});

test("montarWhereNotas exige tenantId e aplica status", () => {
  assert.throws(() => montarWhereNotas({}), /tenantId/);
  const where = montarWhereNotas({
    tenantId: 3,
    status: "autorizada",
    dataInicio: "2026-09-01",
    dataFim: "2026-09-30",
  });
  assert.equal(where.tenantId, 3);
  assert.equal(where.status, "autorizada");
  assert.ok(where.OR);
});
