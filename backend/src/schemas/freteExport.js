const { z } = require("zod");

const optionalDateString = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((v) => (v == null || String(v).trim() === "" ? undefined : String(v).trim()));

const freteItemSchema = z.object({
  produtoId: z.coerce.number().int().positive("produtoId inválido"),
  quantidade: z.coerce.number().positive("quantidade inválida"),
});

/** POST /api/fretes/avulso — valida tipos; regras de negócio permanecem na rota. */
const freteAvulsoSchema = z
  .object({
    clienteId: z.coerce.number().int().positive("clienteId inválido"),
    motoristaId: z.coerce.number().int().positive("motoristaId inválido"),
    produtoId: z.coerce.number().int().positive().optional(),
    quantidade: z.coerce.number().positive().optional(),
    itens: z.array(freteItemSchema).optional(),
    precoSaco: z.coerce.number().min(0).optional().nullable(),
    precoTonelada: z.coerce.number().min(0).optional().nullable(),
    valorTotal: z.coerce.number().positive().optional().nullable(),
    dataMovimento: optionalDateString,
    vencimento: optionalDateString,
    pagamentoData: optionalDateString,
    reciboData: optionalDateString,
    observacao: z.string().max(2000).optional().nullable(),
    reciboNumero: z.string().max(80).optional().nullable(),
    pagoNoAto: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const hasItens = Array.isArray(data.itens) && data.itens.length > 0;
    if (!hasItens && (data.produtoId == null || data.quantidade == null)) {
      ctx.addIssue({
        code: "custom",
        message: "Informe itens ou produtoId + quantidade",
      });
    }
  });

const exportAsyncSchema = z.object({
  dataInicio: z.string().max(40).optional().nullable(),
  dataFim: z.string().max(40).optional().nullable(),
  busca: z.string().max(200).optional().nullable(),
  vendedorId: z.union([z.string(), z.number()]).optional().nullable(),
  motoristaId: z.union([z.string(), z.number()]).optional().nullable(),
  clienteId: z.union([z.string(), z.number()]).optional().nullable(),
  produtoId: z.union([z.string(), z.number()]).optional().nullable(),
  produtoBusca: z.string().max(200).optional().nullable(),
  status: z.string().max(40).optional().nullable(),
});

module.exports = { freteAvulsoSchema, exportAsyncSchema };
