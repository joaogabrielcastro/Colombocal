const { randomUUID } = require("node:crypto");

const jobs = new Map();
const TTL_MS = 30 * 60 * 1000;

function createExportJob(type, payload = {}) {
  const id = randomUUID();
  jobs.set(id, {
    id,
    type,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload,
    result: null,
    error: null,
  });
  return id;
}

function getExportJob(id) {
  cleanupExpiredJobs();
  return jobs.get(id) || null;
}

function markRunning(id) {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "running";
  job.updatedAt = Date.now();
}

function markCompleted(id, result) {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "completed";
  job.result = result;
  job.updatedAt = Date.now();
}

function markFailed(id, error) {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "failed";
  job.error = error instanceof Error ? error.message : String(error);
  job.updatedAt = Date.now();
}

function cleanupExpiredJobs() {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.updatedAt > TTL_MS) jobs.delete(id);
  }
}

module.exports = {
  createExportJob,
  getExportJob,
  markRunning,
  markCompleted,
  markFailed,
  cleanupExpiredJobs,
};
