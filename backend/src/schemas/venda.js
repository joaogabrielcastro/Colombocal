const { z } = require("zod");

/** PATCH /vendas/:id — frete e recibo (campos parciais). */
const vendaFretePatchSchema = z
  .object({
    frete: z
      .preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().nonnegative().optional(),
      )
      .optional(),
    freteRecibo: z.boolean().optional(),
    freteReciboNum: z.union([z.string(), z.null()]).optional(),
    freteReciboData: z.preprocess((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      return v;
    }, z.union([z.null(), z.coerce.date(), z.string()]).optional()),
  })
  .strict();

module.exports = { vendaFretePatchSchema };
