const crypto = require("node:crypto");
const { AppError } = require("../shared/errors/appError");

function stableValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => !["auditActor", "idempotencyKey"].includes(key))
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function requestHash(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue(payload)))
    .digest("hex");
}

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function idempotencyKeyFromRequest(req) {
  const value = String(req.get("Idempotency-Key") || "").trim();
  if (!value) return null;
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
    throw new AppError("Idempotency-Key inválida", {
      code: "IDEMPOTENCY_KEY_INVALIDA",
      httpStatus: 400,
    });
  }
  return value;
}

async function lockSaldoVenda(tx, tenantId, vendaId, clienteId) {
  if (typeof tx.$queryRaw !== "function") return;
  const resourceId = vendaId != null ? Number(vendaId) : -Number(clienteId);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${Number(tenantId)}::int, ${resourceId}::int)::text AS "lock"`;
}

async function lockIdempotencyKey(tx, idempotencyKey) {
  if (!idempotencyKey || typeof tx.$queryRaw !== "function") return;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${String(idempotencyKey)}))::text AS "lock"`;
}

async function buscarReplay(tx, { tenantId, idempotencyKey, tipo, payload }) {
  if (!idempotencyKey || !tx.financeiroOperacaoIdempotente) return null;
  const existing = await tx.financeiroOperacaoIdempotente.findUnique({
    where: { tenantId_chave: { tenantId, chave: idempotencyKey } },
  });
  if (!existing) return null;
  const hash = requestHash(payload);
  if (existing.tipo !== tipo || existing.requestHash !== hash) {
    throw new AppError("Esta chave de operação já foi usada com outros dados", {
      code: "IDEMPOTENCY_KEY_REUTILIZADA",
      httpStatus: 409,
    });
  }
  return existing.resposta;
}

async function salvarResultado(tx, { tenantId, idempotencyKey, tipo, payload, resultado }) {
  if (!idempotencyKey || !tx.financeiroOperacaoIdempotente) return;
  await tx.financeiroOperacaoIdempotente.create({
    data: {
      tenantId,
      chave: idempotencyKey,
      tipo,
      requestHash: requestHash(payload),
      clienteId: payload.clienteId,
      vendaId: payload.vendaId ?? null,
      resposta: jsonSafe(resultado),
    },
  });
}

module.exports = {
  buscarReplay,
  idempotencyKeyFromRequest,
  lockIdempotencyKey,
  lockSaldoVenda,
  requestHash,
  salvarResultado,
};
