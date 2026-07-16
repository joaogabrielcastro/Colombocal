const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findManyBatched,
  EXPORT_MAX_ROWS,
  EXPORT_BATCH_SIZE,
} = require("../src/services/exportBatch");

test("findManyBatched: carrega em lotes e para quando acaba", async () => {
  const calls = [];
  const data = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
  const findMany = async ({ take, skip }) => {
    calls.push({ take, skip });
    return data.slice(skip, skip + take);
  };

  const { rows, truncated, totalFetched } = await findManyBatched(
    findMany,
    { where: {}, orderBy: { id: "asc" } },
    { maxRows: 100, batchSize: 10 },
  );

  assert.equal(totalFetched, 25);
  assert.equal(rows.length, 25);
  assert.equal(truncated, false);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], { take: 10, skip: 0 });
  assert.deepEqual(calls[1], { take: 10, skip: 10 });
  assert.deepEqual(calls[2], { take: 10, skip: 20 });
});

test("findManyBatched: respeita maxRows e marca truncated", async () => {
  const data = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
  const findMany = async ({ take, skip }) => data.slice(skip, skip + take);

  const { rows, truncated } = await findManyBatched(
    findMany,
    {},
    { maxRows: 15, batchSize: 10 },
  );

  assert.equal(rows.length, 15);
  assert.equal(truncated, true);
  assert.equal(EXPORT_MAX_ROWS, 5000);
  assert.equal(EXPORT_BATCH_SIZE, 1000);
});

test("findManyBatched: lista vazia", async () => {
  const findMany = async () => [];
  const { rows, truncated } = await findManyBatched(findMany, {});
  assert.equal(rows.length, 0);
  assert.equal(truncated, false);
});
