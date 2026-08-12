const test = require("node:test");
const assert = require("node:assert/strict");
const {
  EPS,
  aplicarPagamentoNosTitulos,
} = require("../src/domain/financeiro/recebiveis");

test("EPS usado como tolerância de centavos", () => {
  assert.ok(EPS < 0.02);
  assert.ok(EPS > 0);
});

function makeTx(titulos) {
  const updates = [];
  return {
    updates,
    tituloReceber: {
      async findMany({ where }) {
        return titulos.filter((t) => {
          if (where.clienteId != null && t.clienteId !== where.clienteId) return false;
          if (where.vendaId != null && typeof where.vendaId === "object") {
            if (where.vendaId.not != null && t.vendaId === where.vendaId.not) return false;
          } else if (where.vendaId != null && t.vendaId !== where.vendaId) {
            return false;
          }
          if (where.numero?.in && !where.numero.in.includes(t.numero)) return false;
          if (where.status?.in && !where.status.in.includes(t.status)) return false;
          return true;
        });
      },
      async update({ where, data }) {
        const t = titulos.find((x) => x.id === where.id);
        Object.assign(t, data);
        updates.push({ id: where.id, ...data });
        return t;
      },
    },
  };
}

test("pagamento com vendaId não baixa títulos de outras vendas", async () => {
  const titulos = [
    {
      id: 1,
      clienteId: 10,
      vendaId: 5,
      valorOriginal: 100,
      valorPago: 0,
      status: "aberto",
      vencimento: new Date("2026-01-01"),
    },
    {
      id: 2,
      clienteId: 10,
      vendaId: 6,
      valorOriginal: 80,
      valorPago: 0,
      status: "aberto",
      vencimento: new Date("2026-01-02"),
    },
  ];
  const tx = makeTx(titulos);

  await aplicarPagamentoNosTitulos(tx, {
    clienteId: 10,
    vendaId: 5,
    valor: 150,
  });

  assert.equal(titulos[0].status, "quitado");
  assert.equal(titulos[0].valorPago, 100);
  assert.equal(titulos[1].status, "aberto");
  assert.equal(titulos[1].valorPago, 0);
});

test("pagamento sem vendaId baixa títulos do cliente por vencimento", async () => {
  const titulos = [
    {
      id: 1,
      clienteId: 10,
      vendaId: 5,
      valorOriginal: 40,
      valorPago: 0,
      status: "aberto",
      vencimento: new Date("2026-01-01"),
    },
    {
      id: 2,
      clienteId: 10,
      vendaId: 6,
      valorOriginal: 40,
      valorPago: 0,
      status: "aberto",
      vencimento: new Date("2026-01-02"),
    },
  ];
  const tx = makeTx(titulos);

  await aplicarPagamentoNosTitulos(tx, {
    clienteId: 10,
    vendaId: null,
    valor: 50,
  });

  assert.equal(titulos[0].status, "quitado");
  assert.equal(titulos[0].valorPago, 40);
  assert.equal(titulos[1].status, "parcial");
  assert.equal(titulos[1].valorPago, 10);
});

test("pagamento de frete avulso só baixa o título do frete (não a venda)", async () => {
  const titulos = [
    {
      id: 758,
      clienteId: 10,
      vendaId: 69,
      numero: "VENDA-69",
      valorOriginal: 13871.79,
      valorPago: 0,
      status: "aberto",
      vencimento: new Date("2026-09-09"),
    },
    {
      id: 759,
      clienteId: 10,
      vendaId: null,
      numero: "FRETE-AVULSO-57",
      valorOriginal: 5400,
      valorPago: 0,
      status: "aberto",
      vencimento: new Date("2026-09-09"),
    },
  ];
  const tx = makeTx(titulos);

  await aplicarPagamentoNosTitulos(tx, {
    clienteId: 10,
    vendaId: null,
    valor: 5400,
    observacoes: "Pagamento de frete avulso #57",
  });

  assert.equal(titulos[0].valorPago, 0);
  assert.equal(titulos[0].status, "aberto");
  assert.equal(titulos[1].valorPago, 5400);
  assert.equal(titulos[1].status, "quitado");
});

test("limparTitulosFreteAvulsoJaPagos remove título órfão de frete pago", async () => {
  const {
    limparTitulosFreteAvulsoJaPagos,
  } = require("../src/domain/financeiro/recebiveis");
  const titulos = [
    { id: 1, clienteId: 10, numero: "VENDA-43", valorOriginal: 100 },
    { id: 2, clienteId: 10, numero: "FRETE-AVULSO-55", valorOriginal: 3600 },
  ];
  const tx = {
    freteMovimento: {
      async findMany() {
        return [{ id: 55 }];
      },
    },
    tituloReceber: {
      async deleteMany({ where }) {
        const before = titulos.length;
        for (let i = titulos.length - 1; i >= 0; i--) {
          const t = titulos[i];
          if (t.clienteId !== where.clienteId) continue;
          if (where.numero?.in && !where.numero.in.includes(t.numero)) continue;
          titulos.splice(i, 1);
        }
        return { count: before - titulos.length };
      },
    },
  };
  const r = await limparTitulosFreteAvulsoJaPagos(tx, 10);
  assert.equal(r.deleted, 1);
  assert.equal(titulos.length, 1);
  assert.equal(titulos[0].numero, "VENDA-43");
});
