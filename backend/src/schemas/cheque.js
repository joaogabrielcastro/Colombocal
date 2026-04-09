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
 * Ação única e manual: cheques em recebido neste momento → depositado.
 */
const chequeBulkMarcarRecebidoDepositadoAgoraSchema = z.object({
  confirmacao: z.literal("AGORA_TODOS_RECEBIDO_PARA_DEPOSITADO"),
  dataCompensacao: optionalDateInput.optional(),
  limite: z.coerce.number().int().min(1).max(10000).optional(),
});

module.exports = {
  chequeCreateSchema,
  chequeStatusPatchSchema,
  chequeBulkMarcarRecebidoDepositadoAgoraSchema,
};
