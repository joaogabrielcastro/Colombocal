const { z } = require("zod");

const cteEmitirSchema = z.object({
  remetenteNome: z.string().min(1).max(120),
  remetenteDoc: z.string().optional().nullable(),
  destinatarioNome: z.string().min(1).max(120),
  destinatarioDoc: z.string().optional().nullable(),
  tomadorNome: z.string().optional().nullable(),
  tomadorDoc: z.string().optional().nullable(),
  origemMunicipio: z.string().min(1).max(80),
  origemUf: z.string().length(2).transform((s) => s.toUpperCase()),
  origemCodigoMunicipio: z.string().optional().nullable(),
  destinoMunicipio: z.string().min(1).max(80),
  destinoUf: z.string().length(2).transform((s) => s.toUpperCase()),
  destinoCodigoMunicipio: z.string().optional().nullable(),
  valorServico: z.coerce.number().nonnegative().optional().nullable(),
  valorCarga: z.coerce.number().nonnegative().optional().nullable(),
  pesoKg: z.coerce.number().nonnegative().optional().nullable(),
  observacoes: z.string().max(2000).optional().nullable(),
  cfop: z.string().optional(),
  naturezaOperacao: z.string().optional(),
  rntrc: z.string().optional().nullable(),
  produtoPredominante: z.string().optional(),
  chavesNfe: z.array(z.string()).optional(),
  vendaId: z.coerce.number().int().positive().optional().nullable(),
  freteMovimentoId: z.coerce.number().int().positive().optional().nullable(),
  ordemCarregamentoId: z.coerce.number().int().positive().optional().nullable(),
  motoristaId: z.coerce.number().int().positive().optional().nullable(),
});

const cteCancelarSchema = z.object({
  justificativa: z
    .string()
    .trim()
    .min(15, "Justificativa deve ter ao menos 15 caracteres")
    .max(255),
});

module.exports = { cteEmitirSchema, cteCancelarSchema };
