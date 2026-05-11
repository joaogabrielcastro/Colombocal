const path = require("path");
const { execSync } = require("child_process");

const INIT_MIGRATION = "20240101000000_init_schema";

function outputLooksLikeP3009(text) {
  return (
    text.includes("P3009") ||
    text.includes("failed migrations") ||
    text.includes("migrate found failed migrations")
  );
}

/**
 * Executa `prisma migrate deploy`. Com stdio capturado para detetar P3009.
 * @returns {void}
 */
function execMigrateDeploy(backendRoot) {
  try {
    const stdout = execSync("npx prisma migrate deploy", {
      cwd: backendRoot,
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (stdout) process.stdout.write(stdout);
  } catch (e) {
    const stdout = e.stdout != null ? String(e.stdout) : "";
    const stderr = e.stderr != null ? String(e.stderr) : "";
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    const combined = `${stdout}\n${stderr}`;
    const err = new Error(`prisma migrate deploy exit ${e.status ?? "?"}`);
    err.migrateCombinedOutput = combined;
    err.isP3009 = outputLooksLikeP3009(combined);
    throw err;
  }
}

/**
 * Quando RUN_PRISMA_MIGRATE_ON_START=true, executa `prisma migrate deploy` antes do Express subir.
 *
 * Se falhar com P3009 e PRISMA_AUTO_RESOLVE_ROLLED_BACK_FAILED_INIT=true, tenta **uma vez**:
 *   migrate resolve --rolled-back 20240101000000_init_schema && migrate deploy
 *
 * Isto **não apaga nem altera** linhas em Cliente, Vendedor, Motorista, etc.:
 * - `resolve --rolled-back` só ajusta o registo em `_prisma_migrations` (histórico do Prisma).
 * - O segundo `deploy` reaplica o SQL da migração (CREATE TABLE / índices…); não é um “reset de dados”.
 *   Se já existirem tabelas/objetos, costuma falhar com P3018 em vez de sobrescrever dados.
 *
 * O que **destrói** dados é outro fluxo (ex. `db:reset-public-schema` / DROP SCHEMA), não esta opção A.
 * Se após o resolve aparecer P3018, o schema está inconsistente — aí é preciso análise manual ou backup/restore, não “apagar clientes” por esta rotina.
 */
function runPrismaMigrateOnStart() {
  if (process.env.RUN_PRISMA_MIGRATE_ON_START !== "true") {
    return;
  }
  const backendRoot = path.resolve(__dirname, "../..");
  console.log("[startup] RUN_PRISMA_MIGRATE_ON_START: prisma migrate deploy …");

  try {
    execMigrateDeploy(backendRoot);
    console.log("[startup] prisma migrate deploy concluído.");
    return;
  } catch (first) {
    const p3009 = first && first.isP3009 === true;
    const auto =
      process.env.PRISMA_AUTO_RESOLVE_ROLLED_BACK_FAILED_INIT === "true";

    if (!p3009 || !auto) {
      console.error(
        "\n[startup] migrate deploy falhou." +
          (p3009
            ? "\n  P3009: migração inicial marcada como falha. Opções:\n" +
              "  • Desative RUN_PRISMA_MIGRATE_ON_START e rode no container: npm run db:recover\n" +
              "  • Ou defina **uma vez** PRISMA_AUTO_RESOLVE_ROLLED_BACK_FAILED_INIT=true e redeploy.\n"
            : "\n  Verifique logs acima e DATABASE_URL.\n"),
      );
      throw first;
    }

    console.warn(
      `[startup] P3009 + PRISMA_AUTO_RESOLVE_ROLLED_BACK_FAILED_INIT: resolve --rolled-back ${INIT_MIGRATION} …`,
    );
    execSync(`npx prisma migrate resolve --rolled-back ${INIT_MIGRATION}`, {
      stdio: "inherit",
      cwd: backendRoot,
      env: process.env,
    });
    execMigrateDeploy(backendRoot);
    console.log("[startup] prisma migrate deploy concluído após resolve --rolled-back.");
    console.warn(
      "[startup] Remova PRISMA_AUTO_RESOLVE_ROLLED_BACK_FAILED_INIT do ambiente após este deploy com sucesso.",
    );
  }
}

module.exports = { runPrismaMigrateOnStart };
