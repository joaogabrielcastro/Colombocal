const test = require("node:test");
const assert = require("node:assert/strict");

process.env.EXPORT_QUEUE_MODE = "memory";

const {
  createExportJob,
  enqueueExportJob,
  getExportJob,
  exportJobBelongsToTenant,
  markRunning,
  markCompleted,
  markFailed,
  useRedisQueue,
} = require("../src/services/exportJobs");

test("modo memória ativo em testes", () => {
  assert.equal(useRedisQueue(), false);
});

test("export job fica isolado por tenant", async () => {
  const jobId = createExportJob("vendas_csv", 1, { tenantId: "1" });
  const job = await getExportJob(jobId);
  assert.ok(job);
  assert.equal(job.tenantId, 1);
  assert.equal(exportJobBelongsToTenant(job, 1), true);
  assert.equal(exportJobBelongsToTenant(job, 2), false);
});

test("createExportJob rejeita tenantId inválido", () => {
  assert.throws(() => createExportJob("x", "abc"), /tenantId inválido/);
  assert.throws(() => createExportJob("x", 0), /tenantId inválido/);
});

test("getExportJob retorna null para id inexistente", async () => {
  assert.equal(await getExportJob("nao-existe"), null);
});

test("exportJobBelongsToTenant retorna false sem job", () => {
  assert.equal(exportJobBelongsToTenant(null, 1), false);
});

test("markRunning/markCompleted/markFailed atualizam estado", async () => {
  const id = createExportJob("vendas_csv", 2);
  markRunning(id);
  assert.equal((await getExportJob(id)).status, "running");

  markCompleted(id, { content: "a;b", mimeType: "text/csv", filename: "f.csv" });
  assert.equal((await getExportJob(id)).status, "completed");
  assert.equal((await getExportJob(id)).result.filename, "f.csv");

  const id2 = createExportJob("vendas_csv", 2);
  markFailed(id2, new Error("boom"));
  assert.equal((await getExportJob(id2)).status, "failed");
  assert.equal((await getExportJob(id2)).error, "boom");

  markFailed(id2, "texto simples");
  assert.equal((await getExportJob(id2)).error, "texto simples");
});

test("mark* ignoram ids inexistentes sem lançar", () => {
  markRunning("x");
  markCompleted("x", {});
  markFailed("x", new Error("y"));
  assert.ok(true);
});

test("enqueueExportJob rejeita tenant inválido", async () => {
  await assert.rejects(() => enqueueExportJob("vendas_csv", 0, {}), /tenantId inválido/);
});
