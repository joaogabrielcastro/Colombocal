async function createCheque(db, data) {
  return db.cheque.create({ data });
}

async function findChequeById(db, id, include) {
  return db.cheque.findUnique({
    where: { id },
    ...(include ? { include } : {}),
  });
}

async function deleteChequeById(db, id) {
  return db.cheque.delete({ where: { id } });
}

module.exports = {
  createCheque,
  findChequeById,
  deleteChequeById,
};
