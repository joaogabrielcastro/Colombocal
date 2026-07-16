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

const vendaItemSchema = z.object({
  produtoId: z.coerce.number().int().positive(),
  quantidade: z.coerce.number().positive(),
  precoUnitario: z.coerce.number().nonnegative(),
});

const atualizarClienteSchema = z
  .object({
    precos: z
      .array(
        z.object({
          produtoId: z.coerce.number().int().positive(),
          preco: z.coerce.number().nonnegative(),
        }),
      )
      .optional(),
    fretePadraoSaco: z.coerce.number().nonnegative().optional(),
    fretePadraoTonelada: z.coerce.number().nonnegative().optional(),
  })
  .passthrough()
  .optional()
  .nullable();

const vendaCreateBase = {
  clienteId: z.coerce.number().int().positive(),
  vendedorId: z.coerce.number().int().positive(),
  motoristaId: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : v),
      z.coerce.number().int().positive().nullable(),
    )
    .optional(),
  fretePorSaco: z.coerce.number().nonnegative().optional(),
  fretePorTonelada: z.coerce.number().nonnegative().optional(),
  freteRecibo: z.boolean().optional(),
  freteReciboNum: z.union([z.string(), z.null()]).optional(),
  freteReciboData: z.preprocess((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    return v;
  }, z.union([z.null(), z.coerce.date(), z.string()]).optional()),
  dataVenda: z.union([z.coerce.date(), z.string()]).optional(),
  observacoes: z.union([z.string(), z.null()]).optional(),
  itens: z.array(vendaItemSchema).min(1),
  atualizarCliente: atualizarClienteSchema,
};

/** POST /vendas — criação. */
const vendaPostSchema = z.object(vendaCreateBase);

/** PUT /vendas/:id — edição completa (mesmos campos do POST). */
const vendaPutSchema = z.object(vendaCreateBase);

module.exports = {
  vendaFretePatchSchema,
  vendaItemSchema,
  vendaPostSchema,
  vendaPutSchema,
};
