/** Limites de exportação CSV para evitar OOM em tenants grandes. */
const EXPORT_BATCH_SIZE = 1000;
const EXPORT_MAX_ROWS = 5000;

/**
 * Carrega registros em lotes até `maxRows` (padrão 5000).
 * Evita um único findMany gigante em memória.
 *
 * @param {(args: object) => Promise<any[]>} findManyFn
 * @param {object} queryArgs — where/include/select/orderBy (sem take/skip)
 * @param {{ maxRows?: number, batchSize?: number }} [opts]
 * @returns {Promise<{ rows: any[], truncated: boolean, totalFetched: number }>}
 */
async function findManyBatched(findManyFn, queryArgs, opts = {}) {
  const maxRows = opts.maxRows ?? EXPORT_MAX_ROWS;
  const batchSize = opts.batchSize ?? EXPORT_BATCH_SIZE;
  const rows = [];
  let skip = 0;

  while (rows.length < maxRows) {
    const take = Math.min(batchSize, maxRows - rows.length);
    const batch = await findManyFn({
      ...queryArgs,
      take,
      skip,
    });
    if (!batch.length) break;
    rows.push(...batch);
    skip += batch.length;
    if (batch.length < take) break;
  }

  return {
    rows,
    truncated: rows.length >= maxRows,
    totalFetched: rows.length,
  };
}

module.exports = {
  EXPORT_BATCH_SIZE,
  EXPORT_MAX_ROWS,
  findManyBatched,
};
