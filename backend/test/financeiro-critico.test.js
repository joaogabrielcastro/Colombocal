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
    tenantId: 1,
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
    calls.some(
      (c) =>
        c.key === "pagamento.deleteMany" &&
        c.args &&
        c.args.where &&
        c.args.where.tenantId === 1 &&
        Object.keys(c.args.where).length === 1,
    ),
    "Deve remover pagamentos gerais no modo total (escopo tenant)",
  );
});

test("reset financeiro padrão quita títulos e cria ajustes para saldo devedor", async () => {
  const ajustesCriados = [];
  let tituloAtualizado = false;
  const tx = {
    tituloReceber: {
      count: async () => 5,
      deleteMany: async () => {
        throw new Error("não deve remover títulos no modo padrão");
      },
    },
    pagamento: {
      count: async () => 1,
      deleteMany: async () => ({ count: 1 }),
      groupBy: async () => [{ clienteId: 1, _sum: { valor: "200" } }],
      create: async ({ data }) => {
        ajustesCriados.push(data);
        return { id: ajustesCriados.length, ...data };
      },
    },
    cheque: {
      count: async () => 2,
      deleteMany: async () => ({ count: 2 }),
    },
    venda: {
      deleteMany: async () => {
        throw new Error("não deve remover vendas no modo padrão");
      },
      groupBy: async () => [
        { clienteId: 1, _sum: { valorTotal: "1000" } },
        { clienteId: 2, _sum: { valorTotal: "0" } },
      ],
    },
    cliente: {
      findMany: async () => [{ id: 1 }, { id: 2 }],
    },
    $executeRaw: async () => {
      tituloAtualizado = true;
    },
  };
  const prisma = { $transaction: async (fn) => fn(tx) };

  const result = await executarResetFinanceiroLegacy(prisma, { tenantId: 1 });

  assert.equal(tituloAtualizado, true);
  assert.equal(result.titulosAlterados, 5);
  assert.equal(result.chequesRemovidos, 2);
  assert.equal(result.titulosRemovidos, 0);
  assert.equal(result.vendasRemovidas, 0);
  // cliente 1: débito 1000 - crédito 200 = 800 → cria ajuste; cliente 2: sem débito
  assert.equal(result.ajustesCriados, 1);
  assert.equal(ajustesCriados.length, 1);
  assert.equal(ajustesCriados[0].valor, 800);
  assert.equal(ajustesCriados[0].tipo, "transferencia");
});

test("reset financeiro lança sem tenantId", async () => {
  await assert.rejects(
    () => executarResetFinanceiroLegacy({}, {}),
    /tenantId obrigatório/,
  );
});
