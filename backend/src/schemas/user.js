const { z } = require("zod");
const { emailField } = require("./auth");

const createUserSchema = z.object({
  email: emailField,
  password: z.string().min(6).max(200),
  name: z.string().trim().max(200).optional().nullable(),
  role: z.enum(["admin", "member"]).optional(),
});

const changePasswordSchema = z.object({
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(200),
});

module.exports = { createUserSchema, changePasswordSchema };
