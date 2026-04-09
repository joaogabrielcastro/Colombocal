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

/**
 * Ação única e manual: só roda quando você chama a API (não afeta cheques futuros automaticamente).
 * - AGORA_TODOS_A_RECEBER_PARA_RECEBIDO → status recebido
 * - AGORA_TODOS_A_RECEBER_PARA_DEPOSITADO → status depositado (+ data compensação)
 */
const chequeBulkMarcarAReceberAgoraSchema = z.object({
  confirmacao: z.enum([
    "AGORA_TODOS_A_RECEBER_PARA_RECEBIDO",
    "AGORA_TODOS_A_RECEBER_PARA_DEPOSITADO",
  ]),
  dataCompensacao: optionalDateInput.optional(),
  limite: z.coerce.number().int().min(1).max(10000).optional(),
});

module.exports = {
  chequeCreateSchema,
  chequeStatusPatchSchema,
  chequeBulkMarcarAReceberAgoraSchema,
};
