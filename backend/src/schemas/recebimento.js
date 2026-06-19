const { z } = require("zod");

const optionalDateInput = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.union([z.coerce.date(), z.string()]).optional(),
);

const chequeItemSchema = z.object({
  valor: z.coerce.number().min(0.01, "valor deve ser >= 0,01"),
  emitenteNome: z.string().trim().min(2, "informe o nome do emitente"),
  banco: z.union([z.string(), z.null()]).optional(),
  numero: z.union([z.string(), z.null()]).optional(),
  agencia: z.union([z.string(), z.null()]).optional(),
  conta: z.union([z.string(), z.null()]).optional(),
  dataRecebimento: optionalDateInput,
  observacoes: z.union([z.string(), z.null()]).optional(),
});

const pagamentoParcialSchema = z.object({
  valor: z.coerce.number().min(0.01, "valor deve ser >= 0,01"),
  data: optionalDateInput,
  observacoes: z.union([z.string(), z.null()]).optional(),
});

const recebimentoCompostoSchema = z
  .object({
    clienteId: z.coerce.number().int().positive(),
    vendaId: z.coerce.number().int().positive(),
    trocoTipo: z.enum(["dinheiro", "transferencia"]).optional(),
    cheques: z.array(chequeItemSchema).optional().default([]),
    dinheiro: pagamentoParcialSchema.optional(),
    pix: pagamentoParcialSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const temCheque = (data.cheques ?? []).length > 0;
    const temDinheiro = data.dinheiro != null;
    const temPix = data.pix != null;
    if (!temCheque && !temDinheiro && !temPix) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe ao menos um cheque, dinheiro ou PIX",
        path: ["cheques"],
      });
    }
  });

module.exports = {
  recebimentoCompostoSchema,
  chequeItemSchema,
  pagamentoParcialSchema,
};
