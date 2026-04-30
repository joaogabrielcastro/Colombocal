async function findVendaFinanceiraById(db, id) {
  return db.venda.findUnique({
    where: { id },
    include: { titulos: true, pagamentos: true },
  });
}

module.exports = {
  findVendaFinanceiraById,
};
