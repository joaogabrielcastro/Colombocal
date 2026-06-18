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

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await db.cheque.create({
        data: { ...rest, tenantId, numeroOrdem },
      });
    } catch (error) {
      if (isNumeroOrdemConflict(error) && attempt < 7) {
        numeroOrdem += 1;
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
