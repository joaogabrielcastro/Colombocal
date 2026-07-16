const { randomUUID } = require("node:crypto");

const TTL_MS = 30 * 60 * 1000;
const QUEUE_NAME = "colombocal-exports";

/** @type {Map<string, object>} */
const memoryJobs = new Map();

let queue = null;
let worker = null;
let workerStarted = false;

function useRedisQueue() {
  if (process.env.EXPORT_QUEUE_MODE === "memory") return false;
  if (process.env.EXPORT_QUEUE_MODE === "redis") return true;
  if (process.env.NODE_ENV === "test") return false;
  return Boolean(process.env.REDIS_URL);
}

let queueConnection = null;
let workerConnection = null;

function createRedisConnection() {
  const IORedis = require("ioredis");
  return new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
  });
}

function getQueueConnection() {
  if (!queueConnection) queueConnection = createRedisConnection();
  return queueConnection;
}

function getWorkerConnection() {
  if (!workerConnection) workerConnection = createRedisConnection();
  return workerConnection;
}

function cleanupExpiredJobs() {
  const now = Date.now();
  for (const [id, job] of memoryJobs.entries()) {
    if (now - job.updatedAt > TTL_MS) memoryJobs.delete(id);
  }
}

function createExportJob(type, tenantId, payload = {}) {
  const tid = Number(tenantId);
  if (!Number.isFinite(tid) || tid < 1) {
    throw new Error("tenantId inválido ao criar export job");
  }
  const id = randomUUID();
  memoryJobs.set(id, {
    id,
    type,
    tenantId: tid,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload,
    result: null,
    error: null,
  });
  return id;
}

function exportJobBelongsToTenant(job, tenantId) {
  if (!job) return false;
  return job.tenantId === Number(tenantId);
}

function markRunning(id) {
  const job = memoryJobs.get(id);
  if (!job) return;
  job.status = "running";
  job.updatedAt = Date.now();
}

function markCompleted(id, result) {
  const job = memoryJobs.get(id);
  if (!job) return;
  job.status = "completed";
  job.result = result;
  job.updatedAt = Date.now();
}

function markFailed(id, error) {
  const job = memoryJobs.get(id);
  if (!job) return;
  job.status = "failed";
  job.error = error instanceof Error ? error.message : String(error);
  job.updatedAt = Date.now();
}

function getExportJobSync(id) {
  cleanupExpiredJobs();
  return memoryJobs.get(id) || null;
}

function mapBullStatus(state) {
  if (state === "completed") return "completed";
  if (state === "failed") return "failed";
  if (state === "active") return "running";
  return "pending";
}

async function getQueue() {
  if (queue) return queue;
  const { Queue } = require("bullmq");
  queue = new Queue(QUEUE_NAME, {
    connection: getQueueConnection(),
    defaultJobOptions: {
      removeOnComplete: { age: Math.floor(TTL_MS / 1000) },
      removeOnFail: { age: Math.floor(TTL_MS / 1000) },
      attempts: 2,
      backoff: { type: "exponential", delay: 2000 },
    },
  });
  return queue;
}

/**
 * Enfileira export (Redis/BullMQ) ou processa in-process (memória / testes).
 * @returns {Promise<string>} jobId
 */
async function enqueueExportJob(type, tenantId, payload = {}) {
  const tid = Number(tenantId);
  if (!Number.isFinite(tid) || tid < 1) {
    throw new Error("tenantId inválido ao criar export job");
  }

  if (!useRedisQueue()) {
    const jobId = createExportJob(type, tid, payload);
    const { runExportProcessor } = require("./exportProcessors");
    setImmediate(async () => {
      try {
        markRunning(jobId);
        const result = await runExportProcessor(type, tid, payload);
        markCompleted(jobId, result);
      } catch (error) {
        markFailed(jobId, error);
      }
    });
    return jobId;
  }

  const jobId = randomUUID();
  const q = await getQueue();
  await q.add(
    type,
    { tenantId: tid, payload },
    { jobId },
  );
  return jobId;
}

/**
 * @returns {Promise<object|null>}
 */
async function getExportJob(id) {
  if (!useRedisQueue()) {
    return getExportJobSync(id);
  }

  try {
    const { Job } = require("bullmq");
    const q = await getQueue();
    const job = await Job.fromId(q, id);
    if (!job) return null;

    const state = await job.getState();
    const tenantId = Number(job.data?.tenantId);
    const status = mapBullStatus(state);
    return {
      id: job.id,
      type: job.name,
      tenantId,
      status,
      payload: job.data?.payload || {},
      result: status === "completed" ? job.returnvalue : null,
      error:
        status === "failed"
          ? job.failedReason || "Falha na exportação"
          : null,
      createdAt: job.timestamp,
      updatedAt: job.finishedOn || job.processedOn || job.timestamp,
    };
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        type: "export_job_lookup_failed",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return null;
  }
}

/**
 * Inicia o worker BullMQ (chamar uma vez no bootstrap do servidor).
 */
async function startExportWorker() {
  if (!useRedisQueue() || workerStarted) return null;
  workerStarted = true;

  const { Worker } = require("bullmq");
  const { runExportProcessor } = require("./exportProcessors");

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const tenantId = Number(job.data?.tenantId);
      const payload = job.data?.payload || {};
      return runExportProcessor(job.name, tenantId, payload);
    },
    {
      connection: getWorkerConnection(),
      concurrency: Number(process.env.EXPORT_WORKER_CONCURRENCY || 2),
    },
  );

  worker.on("failed", (job, err) => {
    console.error(
      JSON.stringify({
        level: "error",
        type: "export_job_failed",
        jobId: job?.id,
        message: err?.message,
      }),
    );
  });

  console.log("✅ Worker de export CSV (BullMQ/Redis) iniciado");
  return worker;
}

async function stopExportWorker() {
  if (worker) {
    await worker.close();
    worker = null;
    workerStarted = false;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (queueConnection) {
    await queueConnection.quit();
    queueConnection = null;
  }
  if (workerConnection) {
    await workerConnection.quit();
    workerConnection = null;
  }
}

module.exports = {
  createExportJob,
  enqueueExportJob,
  getExportJob,
  getExportJobSync,
  exportJobBelongsToTenant,
  markRunning,
  markCompleted,
  markFailed,
  cleanupExpiredJobs,
  startExportWorker,
  stopExportWorker,
  useRedisQueue,
  TTL_MS,
  QUEUE_NAME,
};
