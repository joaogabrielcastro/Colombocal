#!/usr/bin/env node
/**
 * Aplica as migrações Prisma no banco de TESTE (nunca no de produção).
 * Usa TEST_DATABASE_URL se definido, senão o container local em localhost:5433.
 */
const { execSync } = require("child_process");

const url =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:colombocal_dev@localhost:5433/colombocal_test?schema=public";

console.log(`Aplicando migrações no banco de teste: ${url.replace(/:[^:@/]+@/, ":****@")}`);

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
