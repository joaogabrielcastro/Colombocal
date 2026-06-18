-- Recuperação: base legada com migração marcada aplicada mas sem "Tenant" / "User".
-- Não altera Cliente, Venda, etc. Idempotente (pode correr mais de uma vez).
-- Depois: node -e "... prisma.user.count() ..." e /setup.
--
-- No container: npx prisma db execute --file prisma/manual/ensure-tenant-user-tables.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "Tenant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "User" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant" ("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" ("email");

CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User" ("tenantId");

DO $$
BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "Tenant" ("name", "slug")
SELECT 'Colombocal', 'default'
WHERE NOT EXISTS (SELECT 1 FROM "Tenant" WHERE "slug" = 'default');
