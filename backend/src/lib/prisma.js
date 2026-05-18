const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

/** Uma instância compartilhada evita esgotar conexões em dev (hot reload) e em produção. */
const prisma =
  globalForPrisma.__prismaColombocal ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prismaColombocal = prisma;
}

async function ensureDatabaseCompat() {
  // Backward-compatible guard for environments that are behind migrations.
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Venda"
    ADD COLUMN IF NOT EXISTS "freteTarifaSaco" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "freteTarifaTonelada" DECIMAL(10,2) NOT NULL DEFAULT 0
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Cheque"
    ADD COLUMN IF NOT EXISTS "emitenteNome" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "navPermissions" JSONB
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "FinanceiroEvento"
    ADD COLUMN IF NOT EXISTS "userId" INTEGER,
    ADD COLUMN IF NOT EXISTS "userLabel" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "FinanceiroEvento_tenantId_userId_createdAt_idx"
      ON "FinanceiroEvento"("tenantId", "userId", "createdAt")
  `);
}

module.exports = { prisma, ensureDatabaseCompat };
