-- Isolamento SaaS: tenantId nas tabelas de preço/comissão + e-mail único por tenant

-- PrecoClienteProduto.tenantId
ALTER TABLE "PrecoClienteProduto" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;

UPDATE "PrecoClienteProduto" p
SET "tenantId" = c."tenantId"
FROM "Cliente" c
WHERE c.id = p."clienteId"
  AND (p."tenantId" IS NULL OR p."tenantId" <> c."tenantId");

DELETE FROM "PrecoClienteProduto" WHERE "tenantId" IS NULL;

ALTER TABLE "PrecoClienteProduto" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "PrecoClienteProduto_tenantId_clienteId_idx"
  ON "PrecoClienteProduto"("tenantId", "clienteId");

-- ComissaoClienteProduto.tenantId
ALTER TABLE "ComissaoClienteProduto" ADD COLUMN IF NOT EXISTS "tenantId" INTEGER;

UPDATE "ComissaoClienteProduto" p
SET "tenantId" = c."tenantId"
FROM "Cliente" c
WHERE c.id = p."clienteId"
  AND (p."tenantId" IS NULL OR p."tenantId" <> c."tenantId");

DELETE FROM "ComissaoClienteProduto" WHERE "tenantId" IS NULL;

ALTER TABLE "ComissaoClienteProduto" ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "ComissaoClienteProduto_tenantId_clienteId_idx"
  ON "ComissaoClienteProduto"("tenantId", "clienteId");

-- User: e-mail único por tenant (não global)
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
