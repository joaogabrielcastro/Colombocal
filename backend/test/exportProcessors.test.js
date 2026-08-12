const test = require("node:test");
const assert = require("node:assert/strict");
const {
  formatFretePagoCsv,
  FINANCEIRO_CSV_HEADER,
  TITULOS_CSV_HEADER,
} = require("../src/services/exportProcessors");

test("formatFretePagoCsv: sem frete", () => {
  assert.equal(formatFretePagoCsv({ frete: 0 }), "—");
  assert.equal(formatFretePagoCsv({}), "—");
});

test("formatFretePagoCsv: frete pendente", () => {
  assert.equal(
    formatFretePagoCsv({ frete: 50, freteRecibo: false }),
    "Pagamento pendente",
  );
});

test("formatFretePagoCsv: pago via flag da venda", () => {
  assert.equal(formatFretePagoCsv({ frete: 50, freteRecibo: true }), "Pago");
});

test("formatFretePagoCsv: pago com data no movimento", () => {
  const out = formatFretePagoCsv({
    frete: 50,
    freteRecibo: false,
    fretes: [{ reciboEmitido: true, reciboData: new Date(2026, 0, 15) }],
  });
  assert.match(out, /^Pago em /);
});

test("headers CSV financeiro usam labels de títulos (SSOT)", () => {
  assert.equal(
    FINANCEIRO_CSV_HEADER,
    "Cliente,Original (titulos),Pago (titulos),Em aberto (titulos)",
  );
  assert.doesNotMatch(FINANCEIRO_CSV_HEADER, /Debitos|Pagamentos/);
});

test("headers CSV títulos usam Original/Pago/Em Aberto", () => {
  assert.match(TITULOS_CSV_HEADER, /Valor Original/);
  assert.match(TITULOS_CSV_HEADER, /Valor Pago/);
  assert.match(TITULOS_CSV_HEADER, /Valor em Aberto/);
});
