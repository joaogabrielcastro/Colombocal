const path = require("path");
const { execSync } = require("child_process");

/**
 * Quando RUN_PRISMA_MIGRATE_ON_START=true, executa `prisma migrate deploy` antes do Express subir
 * (útil no Coolify sem job separado de migrate). Se falhar (ex.: P3009), o processo encerra.
 */
function runPrismaMigrateOnStart() {
  if (process.env.RUN_PRISMA_MIGRATE_ON_START !== "true") {
    return;
  }
  const backendRoot = path.resolve(__dirname, "../..");
  console.log("[startup] RUN_PRISMA_MIGRATE_ON_START: prisma migrate deploy …");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    cwd: backendRoot,
    env: process.env,
  });
  console.log("[startup] prisma migrate deploy concluído.");
}

module.exports = { runPrismaMigrateOnStart };
