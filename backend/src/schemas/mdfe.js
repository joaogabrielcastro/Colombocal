const { z } = require("zod");
const { isValidFiscalAccessKey } = require("../utils/fiscalAccessKey");

const mdfeDocumentoSchema = z.object({
  tipo: z.enum(["cte", "nfe"]),
  chaveAcesso: z
    .string()
    .regex(/^\d{44}$/, "Chave de acesso deve conter exatamente 44 dígitos")
    .refine(isValidFiscalAccessKey, "Chave de acesso inválida. Verifique o dígito verificador"),
  documentoId: z.coerce.number().int().positive().optional().nullable(),
});

const mdfeEmitirSchema = z.object({
  emitenteFiscalId: z.coerce.number().int().positive(),
  ufInicio: z.string().length(2).transform((s) => s.toUpperCase()),
  ufFim: z.string().length(2).transform((s) => s.toUpperCase()),
  veiculoPlaca: z.string().min(7).max(10),
  veiculoDescricao: z.string().optional().nullable(),
  veiculoUf: z.string().length(2).optional().nullable(),
  motoristaNome: z.string().optional().nullable(),
  motoristaDoc: z.string().optional().nullable(),
  documentos: z.array(mdfeDocumentoSchema).min(1),
  vendaId: z.coerce.number().int().positive().optional().nullable(),
  freteMovimentoId: z.coerce.number().int().positive().optional().nullable(),
  ordemCarregamentoId: z.coerce.number().int().positive().optional().nullable(),
  motoristaId: z.coerce.number().int().positive().optional().nullable(),
});

const mdfeCancelarSchema = z.object({
  justificativa: z
    .string()
    .trim()
    .min(15, "Justificativa deve ter ao menos 15 caracteres")
    .max(255),
});

const mdfeEncerrarSchema = z.object({
  data: z.string().min(8),
  siglaUf: z.string().length(2).transform((s) => s.toUpperCase()),
  nomeMunicipio: z.string().min(1).max(80),
});

module.exports = {
  mdfeEmitirSchema,
  mdfeCancelarSchema,
  mdfeEncerrarSchema,
};
