const test = require("node:test");
const assert = require("node:assert/strict");
const { setConfig, getConfig } = require("../src/services/configSistema");

test("setConfig atualiza por id sem upsert (liga/desliga)", async () => {
  const rows = new Map();
  let nextId = 1;

  const prisma = {
    configSistema: {
      async findFirst({ where }) {
        const list = [...rows.values()].filter(
          (r) => r.tenantId === where.tenantId && r.chave === where.chave,
        );
        list.sort((a, b) => b.id - a.id);
        return list[0] ?? null;
      },
      async create({ data }) {
        const row = { id: nextId++, ...data };
        rows.set(row.id, row);
        return row;
      },
      async update({ where, data }) {
        const row = rows.get(where.id);
        assert.ok(row, "update espera id existente");
        Object.assign(row, data);
        return row;
      },
    },
  };

  await setConfig(prisma, 1, "NFE_ENABLED", "true");
  assert.equal(await getConfig(prisma, 1, "NFE_ENABLED"), "true");
  assert.equal(rows.size, 1);

  await setConfig(prisma, 1, "NFE_ENABLED", "false");
  assert.equal(await getConfig(prisma, 1, "NFE_ENABLED"), "false");
  assert.equal(rows.size, 1);
  assert.equal([...rows.values()][0].valor, "false");
});
