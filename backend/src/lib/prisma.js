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
}

module.exports = { prisma, ensureDatabaseCompat };
