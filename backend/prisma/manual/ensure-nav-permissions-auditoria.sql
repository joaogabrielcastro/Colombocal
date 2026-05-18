-- Colunas: permissões de menu (User) + auditoria (FinanceiroEvento).
-- Idempotente. Use se o deploy não rodou migrate deploy (ex.: RUN_PRISMA_MIGRATE_ON_START ausente).
--
-- No container Coolify:
--   npx prisma db execute --file prisma/manual/ensure-nav-permissions-auditoria.sql --schema prisma/schema.prisma

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "navPermissions" JSONB;

ALTER TABLE "FinanceiroEvento"
  ADD COLUMN IF NOT EXISTS "userId" INTEGER,
  ADD COLUMN IF NOT EXISTS "userLabel" TEXT;

CREATE INDEX IF NOT EXISTS "FinanceiroEvento_tenantId_userId_createdAt_idx"
  ON "FinanceiroEvento"("tenantId", "userId", "createdAt");
