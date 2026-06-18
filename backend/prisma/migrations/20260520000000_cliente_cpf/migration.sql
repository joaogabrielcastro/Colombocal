-- Cliente: pessoa física (CPF) além de pessoa jurídica (CNPJ)
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "tipoPessoa" TEXT NOT NULL DEFAULT 'PJ';
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "cpf" TEXT;
ALTER TABLE "Cliente" ALTER COLUMN "cnpj" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Cliente_tenantId_cpf_key" ON "Cliente"("tenantId", "cpf");
