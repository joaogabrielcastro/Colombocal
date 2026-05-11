/**
 * Executa o seed do banco (tenants, usuários admin, produtos de exemplo, etc.).
 *
 * Uso na pasta backend:
 *   npm run seed
 *
 * Se o erro for "table does not exist" (P2021), rode antes `npm run db:deploy` ou
 * `npm run seed:deploy` (migrações + seed). Se `migrate deploy` der P3009 (migração inicial
 * falhou no passado), rode `npm run db:recover` e depois `npm run seed`.
 *
 * Variáveis úteis (opcional): DATABASE_URL, SEED_ADMIN_PASSWORD, SEED_ADMIN_EMAIL,
 * SEED_ADMIN_NAME, SEED_DEMO_PASSWORD
 */
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env.local"),
  override: false,
});

require("../prisma/seed.js");
