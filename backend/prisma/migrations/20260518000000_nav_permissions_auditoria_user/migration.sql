-- Permissões de menu por usuário
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "navPermissions" JSONB;

-- Quem registrou o evento de auditoria
ALTER TABLE "FinanceiroEvento" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
ALTER TABLE "FinanceiroEvento" ADD COLUMN IF NOT EXISTS "userLabel" TEXT;

CREATE INDEX IF NOT EXISTS "FinanceiroEvento_tenantId_userId_createdAt_idx"
  ON "FinanceiroEvento"("tenantId", "userId", "createdAt");
