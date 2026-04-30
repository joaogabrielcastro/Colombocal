const { validationError } = require("./validation");

/**
 * @template T
 * @param {import("zod").ZodType<T>} schema
 * @param {unknown} body
 * @returns {T}
 */
function parseBody(schema, body) {
  const r = schema.safeParse(body);
  if (!r.success) {
    const msg = r.error.issues[0]?.message ?? "Dados inválidos";
    throw validationError(msg);
  }
  return r.data;
}

module.exports = { parseBody };
