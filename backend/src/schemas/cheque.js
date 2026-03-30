const { z } = require("zod");

const chequeStatusEnum = z.enum([
  "a_receber",
  "recebido",
  "depositado",
  "devolvido",
]);

const optionalDateInput = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.union([z.coerce.date(), z.string()]).optional(),
);

const chequeCreateSchema = z.object({
  clienteId: z.coerce.number().int().positive(),
  vendaId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  valor: z.coerce.number().min(0.01, "valor deve ser >= 0,01"),
  banco: z.union([z.string(), z.null()]).optional(),
  numero: z.union([z.string(), z.null()]).optional(),
  agencia: z.union([z.string(), z.null()]).optional(),
  conta: z.union([z.string(), z.null()]).optional(),
  dataRecebimento: optionalDateInput,
  dataCompensacao: optionalDateInput,
  status: chequeStatusEnum.optional(),
  observacoes: z.union([z.string(), z.null()]).optional(),
});

const chequeStatusPatchSchema = z.object({
  status: chequeStatusEnum,
  dataCompensacao: optionalDateInput,
});

module.exports = {
  chequeCreateSchema,
  chequeStatusPatchSchema,
};
