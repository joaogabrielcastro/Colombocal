const test = require("node:test");
const assert = require("node:assert/strict");
const {
  limparTrocosOrfaosDoRecebimento,
} = require("../src/domain/financeiro/limparTrocosOrfaos");

function makeTx(pagamentos) {
  return {
    pagamento: {
      async count({ where }) {
        return pagamentos.filter((p) => matchWhere(p, where)).length;
      },
      async deleteMany({ where }) {
        const keep = [];
        let deleted = 0;
        for (const p of pagamentos) {
          if (matchWhere(p, where)) deleted += 1;
          else keep.push(p);
        }
        pagamentos.length = 0;
        pagamentos.push(...keep);
        return { count: deleted };
      },
    },
  };
}

function matchWhere(p, where) {
  if (where.tenantId != null && p.tenantId !== where.tenantId) return false;
  if (where.vendaId !== undefined && p.vendaId !== where.vendaId) return false;
  if (where.clienteId != null && p.clienteId !== where.clienteId) return false;
  if (where.valor?.gt != null && !(p.valor > where.valor.gt)) return false;
  if (where.tipo?.startsWith && !String(p.tipo).startsWith(where.tipo.startsWith)) {
    return false;
  }
  if (where.data?.gte && p.data < where.data.gte) return false;
  if (where.data?.lte && p.data > where.data.lte) return false;
  return true;
}

test("remove troco quando não há mais pagamento positivo no dia", async () => {
  const dia = new Date("2026-08-12T15:00:00");
  const pags = [
    {
      tenantId: 1,
      vendaId: 10,
      clienteId: 2,
      tipo: "troco_dinheiro",
      valor: -50,
      data: dia,
    },
  ];
  const tx = makeTx(pags);
  const r = await limparTrocosOrfaosDoRecebimento(tx, {
    tenantId: 1,
    vendaId: 10,
    clienteId: 2,
    dataRef: dia,
  });
  assert.equal(r.deleted, 1);
  assert.equal(pags.length, 0);
});

test("mantém troco se ainda existe cheque/dinheiro no mesmo dia", async () => {
  const dia = new Date("2026-08-12T15:00:00");
  const pags = [
    {
      tenantId: 1,
      vendaId: 10,
      clienteId: 2,
      tipo: "cheque",
      valor: 200,
      data: dia,
    },
    {
      tenantId: 1,
      vendaId: 10,
      clienteId: 2,
      tipo: "troco_dinheiro",
      valor: -50,
      data: dia,
    },
  ];
  const tx = makeTx(pags);
  const r = await limparTrocosOrfaosDoRecebimento(tx, {
    tenantId: 1,
    vendaId: 10,
    clienteId: 2,
    dataRef: dia,
  });
  assert.equal(r.deleted, 0);
  assert.equal(pags.length, 2);
});
