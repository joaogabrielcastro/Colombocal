async function createPagamento(db, data, include) {
  return db.pagamento.create({
    data,
    ...(include ? { include } : {}),
  });
}

async function findPagamentoById(db, id) {
  return db.pagamento.findUnique({ where: { id } });
}

async function deletePagamentoById(db, id) {
  return db.pagamento.delete({ where: { id } });
}

async function deletePagamentosByChequeId(db, chequeId) {
  return db.pagamento.deleteMany({ where: { chequeId } });
}

module.exports = {
  createPagamento,
  findPagamentoById,
  deletePagamentoById,
  deletePagamentosByChequeId,
};
