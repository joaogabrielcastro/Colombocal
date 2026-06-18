const { z } = require("zod");

const optionalDateInput = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.union([z.coerce.date(), z.string()]).optional(),
);

const chequeCreateSchema = z.object({
  clienteId: z.coerce.number().int().positive(),
  vendaId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  trocoTipo: z.enum(["dinheiro", "transferencia"]).optional(),
  valor: z.coerce.number().min(0.01, "valor deve ser >= 0,01"),
  emitenteNome: z.string().trim().min(2, "informe o nome do emitente").optional(),
  banco: z.union([z.string(), z.null()]).optional(),
  numero: z.union([z.string(), z.null()]).optional(),
  agencia: z.union([z.string(), z.null()]).optional(),
  conta: z.union([z.string(), z.null()]).optional(),
  dataRecebimento: optionalDateInput,
  observacoes: z.union([z.string(), z.null()]).optional(),
});

const chequeLoteItemSchema = z.object({
  valor: z.coerce.number().min(0.01, "valor deve ser >= 0,01"),
  emitenteNome: z.string().trim().min(2, "informe o nome do emitente"),
  banco: z.union([z.string(), z.null()]).optional(),
  numero: z.union([z.string(), z.null()]).optional(),
  agencia: z.union([z.string(), z.null()]).optional(),
  conta: z.union([z.string(), z.null()]).optional(),
  dataRecebimento: optionalDateInput,
  observacoes: z.union([z.string(), z.null()]).optional(),
});

const chequeLoteCreateSchema = z.object({
  clienteId: z.coerce.number().int().positive(),
  vendaId: z.coerce.number().int().positive(),
  trocoTipo: z.enum(["dinheiro", "transferencia"]).optional(),
  itens: z.array(chequeLoteItemSchema).min(1, "informe ao menos um cheque"),
});

module.exports = {
  chequeCreateSchema,
  chequeLoteCreateSchema,
};
