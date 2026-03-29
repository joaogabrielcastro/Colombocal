function parsePagination(query, { defaultTake = 100, maxTake = 500 } = {}) {
  const takeRaw = query?.take;
  const skipRaw = query?.skip;

  let take = defaultTake;
  if (takeRaw !== undefined && takeRaw !== "") {
    const parsedTake = parseInt(takeRaw, 10);
    if (!Number.isNaN(parsedTake) && parsedTake > 0) {
      take = Math.min(parsedTake, maxTake);
    }
  }

  let skip = 0;
  if (skipRaw !== undefined && skipRaw !== "") {
    const parsedSkip = parseInt(skipRaw, 10);
    if (!Number.isNaN(parsedSkip) && parsedSkip >= 0) {
      skip = parsedSkip;
    }
  }

  return { take, skip };
}

function setPaginationHeaders(res, { total, take, skip }) {
  if (typeof total === "number") res.set("x-total-count", String(total));
  if (typeof take === "number") res.set("x-page-size", String(take));
  if (typeof skip === "number") res.set("x-page-offset", String(skip));
}

function handleRouteError(res, error) {
  const status = error?.statusCode || 500;
  res.status(status).json({ error: error?.message || "Erro interno do servidor" });
}

module.exports = {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
};
