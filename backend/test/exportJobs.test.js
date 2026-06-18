const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createExportJob,
  getExportJob,
  exportJobBelongsToTenant,
} = require("../src/services/exportJobs");

test("export job fica isolado por tenant", () => {
  const jobId = createExportJob("vendas_csv", 1, { tenantId: "1" });
  const job = getExportJob(jobId);
  assert.ok(job);
  assert.equal(job.tenantId, 1);
  assert.equal(exportJobBelongsToTenant(job, 1), true);
  assert.equal(exportJobBelongsToTenant(job, 2), false);
});
