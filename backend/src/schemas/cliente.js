const { z } = require("zod");
const { onlyDigits, isValidCpf } = require("../utils/cpf");

const clienteFieldsSchema = z.object({
  razaoSocial: z.string().min(1, "Nome / razão social é obrigatório"),
  nomeFantasia: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  fretePadraoSaco: z.coerce.number().nonnegative().optional(),
  fretePadraoTonelada: z.coerce.number().nonnegative().optional(),
  vendedorId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  comissaoFixaPercentual: z
    .union([z.coerce.number().nonnegative(), z.null()])
    .optional(),
});

function getClienteCreateSchema({ allowsClienteCpf }) {
  return z
    .object({
      tipoPessoa: z.enum(["PJ", "PF"]).optional(),
      cnpj: z.string().optional(),
      cpf: z.string().optional(),
    })
    .merge(clienteFieldsSchema)
    .superRefine((data, ctx) => {
      const tipo =
        data.tipoPessoa || (allowsClienteCpf ? "PF" : "PJ");

      if (tipo === "PF") {
        if (!allowsClienteCpf) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Cadastro por CPF não disponível nesta organização",
            path: ["tipoPessoa"],
          });
          return;
        }
        const cpf = onlyDigits(data.cpf);
        if (!cpf) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "CPF é obrigatório",
            path: ["cpf"],
          });
          return;
        }
        if (!isValidCpf(cpf)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "CPF inválido",
            path: ["cpf"],
          });
        }
        return;
      }

      const cnpj = onlyDigits(data.cnpj);
      if (cnpj.length !== 14) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CNPJ é obrigatório (14 dígitos)",
          path: ["cnpj"],
        });
      }
    })
    .transform((data) => {
      const tipo =
        data.tipoPessoa || (allowsClienteCpf ? "PF" : "PJ");
      if (tipo === "PF") {
        return {
          ...data,
          tipoPessoa: "PF",
          cpf: onlyDigits(data.cpf),
          cnpj: null,
        };
      }
      return {
        ...data,
        tipoPessoa: "PJ",
        cnpj: onlyDigits(data.cnpj),
        cpf: null,
      };
    });
}

const clienteUpdateSchema = z.object({
  razaoSocial: z.string().min(1).optional(),
  nomeFantasia: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  fretePadraoSaco: z.coerce.number().nonnegative().optional(),
  fretePadraoTonelada: z.coerce.number().nonnegative().optional(),
  ativo: z.boolean().optional(),
  vendedorId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  comissaoFixaPercentual: z
    .union([z.coerce.number().nonnegative(), z.null()])
    .optional(),
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
  getClienteCreateSchema,
  clienteUpdateSchema,
  clientePrecosSchema,
};
