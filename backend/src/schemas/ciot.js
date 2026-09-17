const { z } = require("zod");

const ciotRegistrarSchema = z.object({
  tipoOperacao: z.string().optional().nullable(),
  transportadorNome: z.string().min(1).max(120),
  transportadorDoc: z.string().optional().nullable(),
  contratanteNome: z.string().min(1).max(120),
  contratanteDoc: z.string().optional().nullable(),
  motoristaId: z.coerce.number().int().positive().optional().nullable(),
  motoristaNome: z.string().optional().nullable(),
  veiculoPlaca: z.string().optional().nullable(),
  veiculoDescricao: z.string().optional().nullable(),
  origemMunicipio: z.string().min(1).max(80),
  origemUf: z.string().length(2).transform((s) => s.toUpperCase()),
  destinoMunicipio: z.string().min(1).max(80),
  destinoUf: z.string().length(2).transform((s) => s.toUpperCase()),
  valorOperacao: z.coerce.number().nonnegative(),
  observacoes: z.string().max(2000).optional().nullable(),
  freteMovimentoId: z.coerce.number().int().positive().optional().nullable(),
  vendaId: z.coerce.number().int().positive().optional().nullable(),
  dataOperacao: z.string().optional().nullable(),
});

module.exports = { ciotRegistrarSchema };
