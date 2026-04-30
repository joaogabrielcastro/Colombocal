/**
 * Intervalos para filtros Prisma (dataVenda, vencimento, etc.).
 * Datas no formato YYYY-MM-DD são interpretadas no fuso local (meia-noite / fim do dia),
 * evitando deslocamento ao usar new Date("2026-04-01") (UTC).
 */

function parseDateStart(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseDateEnd(raw) {
  const dt = parseDateStart(raw);
  if (!dt) return null;
  const end = new Date(dt.getTime());
  end.setHours(23, 59, 59, 999);
  return end;
}

function getDateRange(dataInicio, dataFim) {
  const where = {};
  const ini = parseDateStart(dataInicio);
  const fim = parseDateEnd(dataFim);
  if (ini) where.gte = ini;
  if (fim) where.lte = fim;
  return where;
}

module.exports = {
  parseDateStart,
  parseDateEnd,
  getDateRange,
};
