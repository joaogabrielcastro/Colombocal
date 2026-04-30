const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseDateStart,
  parseDateEnd,
  getDateRange,
} = require("../src/utils/dateRangeQuery");

test("YYYY-MM-DD início é meia-noite local (relatório comissões / vendas)", () => {
  const d = parseDateStart("2026-04-15");
  assert.ok(d);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 3);
  assert.equal(d.getDate(), 15);
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
});

test("YYYY-MM-DD fim é 23:59:59.999 local", () => {
  const d = parseDateEnd("2026-04-30");
  assert.ok(d);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 3);
  assert.equal(d.getDate(), 30);
  assert.equal(d.getHours(), 23);
  assert.equal(d.getMinutes(), 59);
  assert.equal(d.getSeconds(), 59);
  assert.equal(d.getMilliseconds(), 999);
});

test("getDateRange monta gte/lte para query Prisma", () => {
  const r = getDateRange("2026-04-01", "2026-04-30");
  assert.ok(r.gte);
  assert.ok(r.lte);
  assert.equal(r.gte.getTime() <= r.lte.getTime(), true);
});
