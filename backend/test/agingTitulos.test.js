const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extrasFaixasAging,
  aplicarSituacaoNoWhere,
  diasCivisDesdeVencimento,
  camposVencimentoTitulo,
  pctVencido,
  montarFaixasAging,
} = require("../src/domain/financeiro/agingTitulos");

test("dias civis: atraso, hoje e a vencer", () => {
  const agora = new Date(2026, 8, 13, 15, 0, 0);
  assert.equal(diasCivisDesdeVencimento(new Date(2026, 8, 2, 12, 0, 0), agora), 11);
  assert.equal(diasCivisDesdeVencimento(new Date(2026, 8, 13, 8, 0, 0), agora), 0);
  assert.equal(diasCivisDesdeVencimento(new Date(2026, 8, 18, 8, 0, 0), agora), -5);
});

test("camposVencimentoTitulo não marca atraso em título quitado", () => {
  const agora = new Date(2026, 8, 13);
  const c = camposVencimentoTitulo(
    { vencimento: new Date(2026, 8, 1), valorOriginal: 100, valorPago: 100 },
    agora,
  );
  assert.equal(c.diasAtraso, 0);
  assert.equal(c.venceHoje, false);
});

test("pctVencido usa o total em aberto", () => {
  assert.equal(pctVencido(0, 0), 0);
  assert.ok(Math.abs(pctVencido(25, 100) - 25) < 1e-9);
});

test("faixas de aging: vencido é lt fim do dia; 0-30 começa no fim do dia", () => {
  const agora = new Date(2026, 8, 13, 10, 0, 0);
  const extra = extrasFaixasAging(agora);
  const fim = extra.vencidos.vencimento.lt;
  assert.equal(fim.getHours(), 23);
  assert.equal(extra.ate30.vencimento.gte.getTime(), fim.getTime());
  assert.ok(extra.ate30.vencimento.lte.getTime() > extra.ate30.vencimento.gte.getTime());
  assert.ok(extra.de31a60.vencimento.gt.getTime() >= extra.ate30.vencimento.lte.getTime());
});

test("situacao vencidos/a_vencer reutiliza o corte do aging", () => {
  const agora = new Date(2026, 8, 13, 10, 0, 0);
  const v = aplicarSituacaoNoWhere({ tenantId: 1 }, "vencidos", agora);
  assert.ok(v.AND[0].vencimento.lt);
  const a = aplicarSituacaoNoWhere({ tenantId: 1 }, "a_vencer", agora);
  assert.ok(a.AND[0].vencimento.gte);
  const n = aplicarSituacaoNoWhere({ tenantId: 1 }, "", agora);
  assert.equal(n.AND, undefined);
});

test("montarFaixasAging soma aberto/parcial com a mesma identidade vencido + a vencer", async () => {
  const agora = new Date(2026, 8, 13, 12, 0, 0);
  const calls = [];
  const prisma = {
    tituloReceber: {
      async aggregate({ where }) {
        calls.push(where);
        const venc = where.vencimento;
        if (venc?.lt) return { _sum: { valorOriginal: 80, valorPago: 10 } };
        if (venc?.gte) return { _sum: { valorOriginal: 50, valorPago: 0 } };
        if (venc?.gt && !venc.gte) return { _sum: { valorOriginal: 0, valorPago: 0 } };
        return { _sum: { valorOriginal: 0, valorPago: 0 } };
      },
    },
  };
  const faixas = await montarFaixasAging(prisma, { tenantId: 1 }, agora);
  assert.equal(faixas.vencidos, 70);
  assert.equal(faixas.ate30, 50);
  assert.equal(faixas.totalAVencer, 50);
  assert.ok(calls.every((w) => w.status.in.includes("aberto") && w.status.in.includes("parcial")));
  assert.ok(Math.abs(faixas.vencidos + faixas.totalAVencer - 120) < 1e-9);
});
