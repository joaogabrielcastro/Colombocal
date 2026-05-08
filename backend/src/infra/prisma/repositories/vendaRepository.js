async function findVendaFinanceiraById(db, id, tenantId) {
  return db.venda.findFirst({
    where: { id, tenantId },
    include: { titulos: true, pagamentos: true },
  });
}

module.exports = {
  findVendaFinanceiraById,
};
