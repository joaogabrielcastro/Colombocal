async function createCheque(db, data) {
  const tenantId = data.tenantId;
  if (tenantId == null) {
    throw new Error("createCheque: tenantId obrigatório");
  }
  const agg = await db.cheque.aggregate({
    where: { tenantId },
    _max: { numeroOrdem: true },
  });
  const next = (agg._max.numeroOrdem ?? 0) + 1;
  const { tenantId: _tid, ...rest } = data;
  return db.cheque.create({
    data: { ...rest, tenantId, numeroOrdem: next },
  });
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
  findChequeById,
  deleteChequeById,
};
