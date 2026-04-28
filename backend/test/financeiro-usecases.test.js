const test = require("node:test");
const assert = require("node:assert/strict");
const { registrarPagamento } = require("../src/application/use-cases/registrarPagamento");
const { registrarCheque } = require("../src/application/use-cases/registrarCheque");
const { registrarChequeLote } = require("../src/application/use-cases/registrarChequeLote");
const { AppError } = require("../src/shared/errors/appError");

function makeFakePrisma() {
  const state = {
    vendas: [
      {
        id: 1,
        clienteId: 10,
        titulos: [{ id: 1001, clienteId: 10, vendaId: 1, valorOriginal: 100, valorPago: 0, status: "aberto" }],
      },
    ],
    pagamentos: [],
    cheques: [],
    eventos: [],
    titulos: [{ id: 1001, clienteId: 10, vendaId: 1, valorOriginal: 100, valorPago: 0, status: "aberto" }],
  };
  let pagamentoIdSeq = 1;
  let chequeIdSeq = 1;

  const tx = {
    venda: {
      findUnique: async ({ where }) => {
        const v = state.vendas.find((x) => x.id === where.id);
        if (!v) return null;
        const titulos = state.titulos.filter((t) => t.vendaId === v.id);
        const pagamentos = state.pagamentos.filter((p) => p.vendaId === v.id);
        return { ...v, titulos, pagamentos };
      },
    },
    pagamento: {
      create: async ({ data, include }) => {
        const created = { id: pagamentoIdSeq++, ...data };
        state.pagamentos.push(created);
        if (include) {
          return { ...created, cliente: { id: data.clienteId }, venda: data.vendaId ? { id: data.vendaId } : null };
        }
        return created;
      },
      findMany: async ({ where }) => {
        return state.pagamentos
          .filter((p) => p.clienteId === where.clienteId)
          .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime() || a.id - b.id);
      },
    },
    cheque: {
      create: async ({ data }) => {
        const created = { id: chequeIdSeq++, ...data };
        state.cheques.push(created);
        return created;
      },
      findUnique: async ({ where }) => {
        const ch = state.cheques.find((c) => c.id === where.id);
        if (!ch) return null;
        const pagamento = state.pagamentos.find((p) => p.chequeId === ch.id) || null;
        return { ...ch, cliente: { id: ch.clienteId }, venda: ch.vendaId ? { id: ch.vendaId } : null, pagamento };
      },
    },
    tituloReceber: {
      findMany: async ({ where }) => {
        return state.titulos
          .filter((t) => {
            if (where.clienteId != null && t.clienteId !== where.clienteId) return false;
            if (where.vendaId != null && t.vendaId !== where.vendaId) return false;
            if (where.status?.in && !where.status.in.includes(t.status)) return false;
            return true;
          })
          .sort((a, b) => a.id - b.id);
      },
      update: async ({ where, data }) => {
        const idx = state.titulos.findIndex((t) => t.id === where.id);
        state.titulos[idx] = { ...state.titulos[idx], ...data };
        return state.titulos[idx];
      },
    },
    financeiroEvento: {
      create: async ({ data }) => {
        state.eventos.push(data);
        return data;
      },
    },
  };

  const prisma = {
    $transaction: async (fn) => fn(tx),
    cheque: tx.cheque,
  };

  return { prisma, state };
}

test("registrarPagamento cria troco quando pagamento excede saldo da venda", async () => {
  const { prisma, state } = makeFakePrisma();
  const pagamento = await registrarPagamento(prisma, {
    clienteId: 10,
    vendaId: 1,
    tipo: "dinheiro",
    valor: 150,
    trocoTipo: "transferencia",
    data: "2026-04-27",
  });

  assert.equal(pagamento.valor, 100);
  assert.equal(state.pagamentos.length, 2);
  assert.equal(state.pagamentos[0].tipo, "dinheiro");
  assert.equal(state.pagamentos[0].valor, 100);
  assert.equal(state.pagamentos[1].tipo, "troco_transferencia");
  assert.equal(state.pagamentos[1].valor, -50);
});

test("registrarCheque retorna troco quando cheque excede saldo da venda", async () => {
  const { prisma, state } = makeFakePrisma();
  const result = await registrarCheque(prisma, {
    clienteId: 10,
    vendaId: 1,
    valor: 120,
    emitenteNome: "Fulano",
    dataRecebimento: "2026-04-27",
    trocoTipo: "dinheiro",
  });

  assert.equal(result.trocoValor, 20);
  assert.equal(result.trocoTipo, "dinheiro");
  assert.equal(state.cheques.length, 1);
  assert.equal(state.pagamentos.length, 2);
  assert.equal(state.pagamentos[0].tipo, "cheque");
  assert.equal(state.pagamentos[0].valor, 100);
  assert.equal(state.pagamentos[1].tipo, "troco_dinheiro");
  assert.equal(state.pagamentos[1].valor, -20);
});

test("registrarChequeLote exige trocoTipo quando lote excede saldo", async () => {
  const { prisma } = makeFakePrisma();
  await assert.rejects(
    () =>
      registrarChequeLote(prisma, {
        clienteId: 10,
        vendaId: 1,
        itens: [
          { emitenteNome: "A", valor: 70 },
          { emitenteNome: "B", valor: 50 },
        ],
      }),
    (err) => err instanceof AppError && err.code === "LOTE_EXCEDE_SALDO",
  );
});

test("registrarChequeLote cria troco quando total excede saldo", async () => {
  const { prisma, state } = makeFakePrisma();
  const result = await registrarChequeLote(prisma, {
    clienteId: 10,
    vendaId: 1,
    trocoTipo: "transferencia",
    itens: [
      { emitenteNome: "A", valor: 70, dataRecebimento: "2026-04-27" },
      { emitenteNome: "B", valor: 50, dataRecebimento: "2026-04-27" },
    ],
  });

  assert.equal(result.chequesCriados, 2);
  assert.equal(result.excedente, 20);
  assert.equal(result.trocoTipo, "transferencia");
  assert.equal(state.cheques.length, 2);
  assert.equal(state.pagamentos.length, 3);
  assert.equal(state.pagamentos[2].tipo, "troco_transferencia");
  assert.equal(state.pagamentos[2].valor, -20);
});
