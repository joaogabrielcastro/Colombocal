async function getNextNumeroOrdem(db, tenantId) {
  const agg = await db.cheque.aggregate({
    where: { tenantId },
    _max: { numeroOrdem: true },
  });
  return (agg._max.numeroOrdem ?? 0) + 1;
}

function isNumeroOrdemConflict(error) {
  if (error?.code !== "P2002") return false;
  const target = error.meta?.target;
  if (target === "numeroOrdem") return true;
  if (Array.isArray(target) && target.includes("numeroOrdem")) return true;
  if (typeof target === "string" && target.includes("numeroOrdem")) return true;
  return false;
}

/** Em transaction Postgres, P2002 aborta o bloco — savepoint permite retry. */
async function withSavepoint(db, name, fn, enabled) {
  if (!enabled || typeof db.$executeRawUnsafe !== "function") {
    return fn();
  }

  await db.$executeRawUnsafe(`SAVEPOINT ${name}`);
  try {
    const result = await fn();
    await db.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`);
    return result;
  } catch (error) {
    try {
      await db.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
    } catch {
      /* ignore */
    }
    throw error;
  }
}

async function createCheque(db, data, options = {}) {
  const tenantId = data.tenantId;
  if (tenantId == null) {
    throw new Error("createCheque: tenantId obrigatório");
  }
  const { tenantId: _tid, ...rest } = data;
  let numeroOrdem =
    options.numeroOrdem != null
      ? options.numeroOrdem
      : await getNextNumeroOrdem(db, tenantId);
  // Só use savepoint quando o caller já está em prisma.$transaction
  const useSavepoint = options.useSavepoint === true;

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await withSavepoint(
        db,
        `cheque_ordem_${attempt}`,
        () =>
          db.cheque.create({
            data: { ...rest, tenantId, numeroOrdem },
          }),
        useSavepoint,
      );
    } catch (error) {
      if (isNumeroOrdemConflict(error) && attempt < 7) {
        const next = await getNextNumeroOrdem(db, tenantId);
        numeroOrdem = Math.max(next, numeroOrdem + 1);
        continue;
      }
      throw error;
    }
  }
}

async function findChequeById(db, id, tenantId, include) {
  return db.cheque.findFirst({
    where: { id, tenantId },
    ...(include ? { include } : {}),
  });
}

async function deleteChequeById(db, id, tenantId) {
  return db.cheque.deleteMany({ where: { id, tenantId } });
}

module.exports = {
  createCheque,
  getNextNumeroOrdem,
  findChequeById,
  deleteChequeById,
};
