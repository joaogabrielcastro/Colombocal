const test = require("node:test");
const assert = require("node:assert/strict");
const { splitValorComTroco } = require("../src/domain/financeiro/saldoVenda");
const { executarResetFinanceiroLegacy } = require("../src/services/resetFinanceiroLegacy");

test("splitValorComTroco separa principal e troco quando valor excede saldo", () => {
  const result = splitValorComTroco(150, 100);
  assert.equal(result.valorPrincipal, 100);
  assert.equal(result.trocoValor, 50);
});

test("splitValorComTroco nao gera troco quando valor menor/igual ao saldo", () => {
  assert.deepEqual(splitValorComTroco(80, 100), { valorPrincipal: 80, trocoValor: 0 });
  assert.deepEqual(splitValorComTroco(100, 100), { valorPrincipal: 100, trocoValor: 0 });
});

test("reset financeiro total remove vendas e titulos", async () => {
  const calls = [];
  const tx = {
    tituloReceber: {
      count: async () => 3,
      deleteMany: async () => ({ count: 3 }),
    },
    pagamento: {
      count: async () => 2,
      deleteMany: async (args) => {
        calls.push({ key: "pagamento.deleteMany", args });
        return { count: 2 };
      },
      groupBy: async () => [],
    },
    cheque: {
      count: async () => 1,
      deleteMany: async () => ({ count: 1 }),
    },
    venda: {
      deleteMany: async () => ({ count: 4 }),
      groupBy: async () => [],
    },
    freteMovimento: {
      deleteMany: async () => ({ count: 0 }),
    },
    cliente: {
      findMany: async () => [],
    },
    $executeRaw: async () => {
      throw new Error("Nao deve atualizar titulos no modo de remocao total");
    },
  };

  const prisma = {
    $transaction: async (fn) => fn(tx),
  };

  const result = await executarResetFinanceiroLegacy(prisma, {
    criarAjustes: false,
    zerarPagamentosGerais: true,
    zerarVendasETitulos: true,
  });

  assert.equal(result.titulosRemovidos, 3);
  assert.equal(result.vendasRemovidas, 4);
  assert.equal(result.chequesRemovidos, 1);
  assert.equal(result.pagamentosGeraisRemovidos, 2);
  assert.equal(result.modo.zerarVendasETitulos, true);
  assert.ok(
    calls.some((c) => c.key === "pagamento.deleteMany" && c.args && !c.args.where),
    "Deve remover pagamentos gerais no modo total",
  );
});
