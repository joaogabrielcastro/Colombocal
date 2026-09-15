const { z } = require("zod");

/** Aceita e-mails operacionais do seed (ex.: admin@local), sem RFC estrito. */
const emailField = z
  .string()
  .trim()
  .min(3, "Informe um e-mail válido")
  .max(320)
  .refine((v) => /^[^\s@]+@[^\s@]+$/.test(v), "Informe um e-mail válido");

const forgotPasswordSchema = z.object({
  email: emailField,
  tenantSlug: z.string().trim().toLowerCase().max(80).optional().nullable(),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(20).max(512),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(200),
});

module.exports = { forgotPasswordSchema, resetPasswordSchema, emailField };
