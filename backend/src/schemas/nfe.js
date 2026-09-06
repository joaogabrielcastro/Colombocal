const { z } = require("zod");
const { onlyDigits } = require("../utils/cpf");

const optionalDigits = (len) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v == null || String(v).trim() === "") return null;
      const d = onlyDigits(v);
      return d || null;
    })
    .refine((v) => v === undefined || v == null || v.length === len, {
      message: `Informe ${len} dígitos`,
    });

const emitenteFiscalSchema = z.object({
  cnpj: z
    .string()
    .min(1, "CNPJ é obrigatório")
    .transform((s) => onlyDigits(s))
    .refine((s) => s.length === 14, "CNPJ deve ter 14 dígitos"),
  inscricaoEstadual: z
    .string()
    .min(1, "Inscrição estadual é obrigatória")
    .transform((s) => {
      const t = String(s).trim();
      if (t.toUpperCase() === "ISENTO") return "ISENTO";
      return onlyDigits(t);
    })
    .refine((s) => s === "ISENTO" || s.length >= 2, "IE inválida"),
  razaoSocial: z.string().min(1, "Razão social é obrigatória").max(120),
  nomeFantasia: z.string().nullable().optional(),
  crt: z.coerce.number().int().refine((n) => [1, 2, 3].includes(n), "CRT inválido"),
  logradouro: z.string().min(1, "Logradouro é obrigatório").max(120),
  numero: z.string().min(1, "Número é obrigatório").max(20),
  complemento: z.string().nullable().optional(),
  bairro: z.string().min(1, "Bairro é obrigatório").max(80),
  municipio: z.string().min(1, "Município é obrigatório").max(80),
  codigoMunicipio: z
    .string()
    .transform((s) => onlyDigits(s))
    .refine((s) => s.length === 7, "Código IBGE deve ter 7 dígitos"),
  uf: z
    .string()
    .transform((s) => String(s).trim().toUpperCase())
    .refine((s) => s.length === 2, "UF inválida"),
  cep: z
    .string()
    .transform((s) => onlyDigits(s))
    .refine((s) => s.length === 8, "CEP deve ter 8 dígitos"),
  telefone: z.string().nullable().optional(),
  serieNfe: z.coerce.number().int().positive().default(1),
  ambiente: z.enum(["homologacao", "producao"]).default("homologacao"),
  naturezaOperacao: z.string().max(60).optional(),
  modalidadeFrete: z.coerce.number().int().min(0).max(9).default(9),
  provedorToken: z.string().nullable().optional(),
});

const nfeCancelarSchema = z.object({
  justificativa: z
    .string()
    .trim()
    .min(15, "Justificativa deve ter ao menos 15 caracteres")
    .max(255),
});

const clienteFiscalFieldsSchema = z.object({
  inscricaoEstadual: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v == null || String(v).trim() === "") return null;
      const t = String(v).trim();
      if (t.toUpperCase() === "ISENTO") return "ISENTO";
      return onlyDigits(t) || null;
    }),
  indIEDest: z
    .union([z.literal(""), z.null(), z.coerce.number().int()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      return v === "" || v == null ? null : v;
    })
    .refine((v) => v === undefined || v == null || [1, 2, 9].includes(v), "indIEDest deve ser 1, 2 ou 9"),
  cep: optionalDigits(8),
  bairro: z.string().nullable().optional(),
  numero: z.string().nullable().optional(),
  complemento: z.string().nullable().optional(),
  codigoMunicipio: optionalDigits(7),
});

module.exports = {
  emitenteFiscalSchema,
  nfeCancelarSchema,
  clienteFiscalFieldsSchema,
};
