async function createPagamento(db, data, include) {
  return db.pagamento.create({
    data,
    ...(include ? { include } : {}),
  });
}

async function findPagamentoById(db, id, tenantId) {
  return db.pagamento.findFirst({ where: { id, tenantId } });
}

async function deletePagamentoById(db, id, tenantId) {
  return db.pagamento.deleteMany({ where: { id, tenantId } });
}

async function deletePagamentosByChequeId(db, chequeId, tenantId) {
  return db.pagamento.deleteMany({ where: { chequeId, tenantId } });
}

module.exports = {
  createPagamento,
  findPagamentoById,
  deletePagamentoById,
  deletePagamentosByChequeId,
};
