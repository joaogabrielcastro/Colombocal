const { z } = require("zod");
const { onlyDigits } = require("../utils/cpf");

function emptyToNull(schema) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || String(v).trim() === "") return null;
      return String(v).trim();
    });
}

const produtoFiscalPatch = {
  ncm: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || String(v).trim() === "") return null;
      const d = onlyDigits(v);
      return d || null;
    })
    .refine((v) => v == null || v.length === 8, "NCM deve ter 8 dígitos"),
  cfopPadraoDentro: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || String(v).trim() === "") return null;
      const d = onlyDigits(v);
      return d || null;
    })
    .refine((v) => v == null || v.length === 4, "CFOP deve ter 4 dígitos"),
  cfopPadraoFora: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v == null || String(v).trim() === "") return null;
      const d = onlyDigits(v);
      return d || null;
    })
    .refine((v) => v == null || v.length === 4, "CFOP deve ter 4 dígitos"),
  origem: z.coerce.number().int().min(0).max(8).optional(),
  cst: emptyToNull(),
  csosn: emptyToNull(),
};

module.exports = { produtoFiscalPatch };
