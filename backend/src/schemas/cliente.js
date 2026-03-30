const { z } = require("zod");

const clienteCreateSchema = z.object({
  cnpj: z.string().min(1, "CNPJ é obrigatório"),
  razaoSocial: z.string().min(1, "Razão social é obrigatória"),
  nomeFantasia: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  fretePadrao: z.coerce.number().nonnegative().optional(),
  vendedorId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  comissaoFixaPercentual: z.union([
    z.coerce.number().nonnegative(),
    z.null(),
  ]).optional(),
});

const clienteUpdateSchema = z.object({
  razaoSocial: z.string().min(1).optional(),
  nomeFantasia: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  fretePadrao: z.coerce.number().nonnegative().optional(),
  ativo: z.boolean().optional(),
  vendedorId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  comissaoFixaPercentual: z.union([
    z.coerce.number().nonnegative(),
    z.null(),
  ]).optional(),
});

const clientePrecosSchema = z.object({
  precos: z
    .array(
      z.object({
        produtoId: z.coerce.number().int().positive(),
        preco: z.union([z.coerce.number().nonnegative(), z.null()]),
      }),
    )
    .min(1, "Informe ao menos um preço"),
});

module.exports = {
  clienteCreateSchema,
  clienteUpdateSchema,
  clientePrecosSchema,
};
