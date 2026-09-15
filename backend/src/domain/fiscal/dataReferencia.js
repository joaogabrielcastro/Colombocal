/**
 * Data de referência fiscal: COALESCE(autorizadaEm, emitidaEm, createdAt).
 * Usada para filtrar períodos de listagem e fechamento.
 */

function dataReferenciaNota(nota) {
  if (!nota) return null;
  if (nota.autorizadaEm) return new Date(nota.autorizadaEm);
  if (nota.emitidaEm) return new Date(nota.emitidaEm);
  if (nota.createdAt) return new Date(nota.createdAt);
  return null;
}

/**
 * Cláusula Prisma equivalente a COALESCE(autorizadaEm, emitidaEm, createdAt) no intervalo.
 * @param {{ gte?: Date, lte?: Date }} range
 */
function whereDataReferenciaNoPeriodo(range) {
  if (!range || (!range.gte && !range.lte)) return {};
  return {
    OR: [
      { autorizadaEm: range },
      {
        AND: [{ autorizadaEm: null }, { emitidaEm: range }],
      },
      {
        AND: [{ autorizadaEm: null }, { emitidaEm: null }, { createdAt: range }],
      },
    ],
  };
}

module.exports = {
  dataReferenciaNota,
  whereDataReferenciaNoPeriodo,
};
