/**
 * Apaga e recria o schema `public` no Postgres (remove TODAS as tabelas e dados desse schema,
 * incluindo `_prisma_migrations`). Use quando a migração inicial falhou no meio (ex.: P3018
 * "relation already exists") e o banco não tem dados que você precise manter.
 *
 * Uso (pasta backend, com DATABASE_URL):
 *   CONFIRM_RESET_PUBLIC_SCHEMA=YES npm run db:reset-public-schema
 *
 * Em NODE_ENV=production também exija:
 *   ALLOW_PUBLIC_SCHEMA_RESET_IN_PRODUCTION=YES
 *
 * Depois:
 *   npx prisma migrate deploy
 *   npm run db:seed
 */
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env.local"),
  override: false,
});

const { prisma } = require("../src/lib/prisma");

async function main() {
  if (process.env.CONFIRM_RESET_PUBLIC_SCHEMA !== "YES") {
    console.error(
      "Este script apaga TODO o conteúdo do schema public (tabelas, dados, histórico Prisma nesse schema).",
    );
    console.error(
      "Para executar: CONFIRM_RESET_PUBLIC_SCHEMA=YES npm run db:reset-public-schema",
    );
    process.exit(1);
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PUBLIC_SCHEMA_RESET_IN_PRODUCTION !== "YES"
  ) {
    console.error(
      "Em produção, defina também ALLOW_PUBLIC_SCHEMA_RESET_IN_PRODUCTION=YES (e faça backup antes).",
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não definido.");
    process.exit(1);
  }

  console.log("Executando DROP SCHEMA public CASCADE; CREATE SCHEMA public; ...");

  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO CURRENT_USER`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);

  console.log("\nSchema public recriado. Próximos passos:\n  npx prisma migrate deploy\n  npm run db:seed\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
