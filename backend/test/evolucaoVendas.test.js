const test = require("node:test");
const assert = require("node:assert/strict");
const { montarEvolucaoPeriodo, toCalendarYmd } = require("../src/utils/evolucaoVendas");

test("toCalendarYmd trata meia-noite UTC como data civil", () => {
  assert.equal(toCalendarYmd("2026-08-01T00:00:00.000Z"), "2026-08-01");
  assert.equal(toCalendarYmd("2026-08-01T12:00:00.000Z"), "2026-08-01");
});

test("evolução diária no período curto soma faturamento e quantidade", () => {
  const out = montarEvolucaoPeriodo(
    [
      { dataVenda: "2026-08-01T12:00:00.000Z", valorTotal: 100 },
      { dataVenda: "2026-08-01T12:00:00.000Z", valorTotal: 50 },
      { dataVenda: "2026-08-03T12:00:00.000Z", valorTotal: 200 },
    ],
    "2026-08-01",
    "2026-08-03",
  );
  assert.equal(out.granularidade, "dia");
  assert.equal(out.pontos.length, 3);
  assert.equal(out.pontos[0].faturamento, 150);
  assert.equal(out.pontos[0].quantidade, 2);
  assert.equal(out.pontos[1].faturamento, 0);
  assert.equal(out.pontos[1].quantidade, 0);
  assert.equal(out.pontos[2].faturamento, 200);
  assert.equal(out.pontos[2].quantidade, 1);
});

test("período longo usa granularidade mensal", () => {
  const out = montarEvolucaoPeriodo(
    [
      { dataVenda: "2026-01-15T12:00:00.000Z", valorTotal: 10 },
      { dataVenda: "2026-03-02T12:00:00.000Z", valorTotal: 30 },
    ],
    "2026-01-01",
    "2026-03-31",
  );
  assert.equal(out.granularidade, "mes");
  assert.equal(out.pontos.length, 3);
  assert.equal(out.pontos[0].periodo, "2026-01");
  assert.equal(out.pontos[0].faturamento, 10);
  assert.equal(out.pontos[1].faturamento, 0);
  assert.equal(out.pontos[2].faturamento, 30);
});

test("sem vendas retorna série vazia", () => {
  const out = montarEvolucaoPeriodo([], "2026-08-01", "2026-08-10");
  assert.equal(out.granularidade, "dia");
  assert.equal(out.pontos.length, 10);
  assert.ok(out.pontos.every((p) => p.quantidade === 0 && p.faturamento === 0));
});

test("série esparsa em muitos dias omite zeros para não poluir", () => {
  const out = montarEvolucaoPeriodo(
    [{ dataVenda: "2026-08-01T12:00:00.000Z", valorTotal: 10 }],
    "2026-08-01",
    "2026-08-31",
  );
  assert.equal(out.granularidade, "dia");
  assert.equal(out.pontos.length, 1);
  assert.equal(out.pontos[0].periodo, "2026-08-01");
});

test("45 dias permanece diário e 46 dias passa a mensal", () => {
  const dia = montarEvolucaoPeriodo(
    [{ dataVenda: "2026-01-01T12:00:00.000Z", valorTotal: 10 }],
    "2026-01-01",
    "2026-02-14",
  );
  assert.equal(dia.granularidade, "dia");
  const mes = montarEvolucaoPeriodo(
    [{ dataVenda: "2026-01-01T12:00:00.000Z", valorTotal: 10 }],
    "2026-01-01",
    "2026-02-15",
  );
  assert.equal(mes.granularidade, "mes");
});

test("um dia e virada de ano", () => {
  const umDia = montarEvolucaoPeriodo(
    [{ dataVenda: "2026-09-06T12:00:00.000Z", valorTotal: 25 }],
    "2026-09-06",
    "2026-09-06",
  );
  assert.equal(umDia.pontos.length, 1);
  assert.equal(umDia.pontos[0].faturamento, 25);
  assert.equal(umDia.pontos[0].quantidade, 1);

  const ano = montarEvolucaoPeriodo(
    [
      { dataVenda: "2025-12-31T12:00:00.000Z", valorTotal: 10 },
      { dataVenda: "2026-01-01T12:00:00.000Z", valorTotal: 15 },
    ],
    "2025-12-01",
    "2026-01-31",
  );
  assert.equal(ano.granularidade, "mes");
  assert.deepEqual(ano.pontos.map((p) => p.periodo), ["2025-12", "2026-01"]);
  assert.equal(ano.pontos[0].faturamento, 10);
  assert.equal(ano.pontos[1].faturamento, 15);
});
