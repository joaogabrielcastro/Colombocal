const { z } = require("zod");
const { produtoFiscalPatch } = require("./produtoFiscal");

const optionalNonNegNumber = z.preprocess((v) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v === "string") return String(v).replace(",", ".");
  return v;
}, z.union([z.coerce.number().nonnegative(), z.null()]).optional());

/** Campos desconhecidos são ignorados (UI às vezes reenvia o objeto completo). */
const produtoCreateSchema = z.object({
  nome: z.string().trim().min(1, "nome é obrigatório").max(160),
  codigo: z
    .union([z.string().trim().max(80), z.null()])
    .optional()
    .transform((v) => (v == null || String(v).trim() === "" ? undefined : String(v).trim())),
  precoPadrao: z.coerce.number().nonnegative("precoPadrao inválido"),
  unidade: z
    .union([z.string().trim().max(20), z.null()])
    .optional()
    .transform((v) => (v == null || String(v).trim() === "" ? "ton" : String(v).trim())),
  pesoKg: optionalNonNegNumber,
  ...produtoFiscalPatch,
});

const produtoUpdateSchema = z.object({
  nome: z.string().trim().min(1, "nome é obrigatório").max(160).optional(),
  codigo: z
    .union([z.string().trim().max(80), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v == null || String(v).trim() === "") return null;
      return String(v).trim();
    }),
  precoPadrao: z.coerce.number().nonnegative("precoPadrao inválido").optional(),
  unidade: z
    .union([z.string().trim().max(20), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v == null || String(v).trim() === "") return "ton";
      return String(v).trim();
    }),
  ativo: z.boolean().optional(),
  pesoKg: optionalNonNegNumber,
  ...produtoFiscalPatch,
});

module.exports = {
  produtoCreateSchema,
  produtoUpdateSchema,
};
