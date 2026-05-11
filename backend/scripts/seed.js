/**
 * Executa o seed do banco (tenants, usuários admin, produtos de exemplo, etc.).
 *
 * Uso na pasta backend:
 *   npm run db:seed
 *
 * Migração + seed: npm run seed:deploy. P3009: npm run db:recover. P3018 (schema pela metade): ver prisma/seed.js.
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
