const { z } = require("zod");

const pagamentoCreateSchema = z.object({
  clienteId: z.coerce.number().int().positive(),
  vendaId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  tipo: z.enum(["dinheiro", "transferencia", "cheque"]),
  valor: z.coerce.number().min(0.01, "valor deve ser >= 0,01"),
  data: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.union([z.coerce.date(), z.string()]).optional(),
  ),
  observacoes: z.string().optional(),
});

module.exports = { pagamentoCreateSchema };
