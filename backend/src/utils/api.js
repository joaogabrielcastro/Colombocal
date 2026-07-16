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

function friendlyErrorMessage(error) {
  if (error?.name === "AppError" && error.message) {
    return error.message;
  }
  if (error?.code === "P2002") {
    const target = error.meta?.target;
    const fields = Array.isArray(target)
      ? target
      : typeof target === "string"
        ? [target]
        : [];
    if (fields.some((f) => String(f).includes("numeroOrdem"))) {
      return "Não foi possível gerar o número interno do cheque. Clique em salvar novamente.";
    }
    return "Registro duplicado. Verifique os dados e tente outra vez.";
  }
  if (error?.name === "PrismaClientKnownRequestError") {
    return "Erro ao gravar no banco de dados. Tente novamente.";
  }
  const msg = error?.message || "";
  if (msg.includes("prisma.") || msg.includes("Invalid `prisma.")) {
    return "Erro ao gravar no banco de dados. Tente novamente ou contate o suporte.";
  }
  return error?.message || "Erro interno do servidor";
}

function handleRouteError(res, error) {
  let status = error?.httpStatus || error?.statusCode || error?.status;
  if (!status && error?.code === "P2002") status = 409;
  if (!status) status = 500;
  const payload = { error: friendlyErrorMessage(error) };
  if (error?.code) payload.code = error.code;
  res.status(status).json(payload);
}

module.exports = {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
};
