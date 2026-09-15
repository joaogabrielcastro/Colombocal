/**
 * Garante seed de usuários E2E no banco apontado por DATABASE_URL.
 * Rodado antes da suíte Playwright (após migrations no CI).
 */
const { spawnSync } = require("child_process");
const path = require("path");

module.exports = async function globalSetup() {
  const backendDir = path.resolve(__dirname, "..", "backend");
  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ||
      process.env.TEST_DATABASE_URL ||
      "postgresql://postgres:colombocal_dev@127.0.0.1:5436/colombocal_test?schema=public",
  };
  const result = spawnSync("npm", ["run", "db:seed"], {
    cwd: backendDir,
    env,
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`db:seed falhou com código ${result.status}`);
  }
  console.log("E2E globalSetup: seed OK");
};
