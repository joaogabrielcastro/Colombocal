/**
 * Executa o seed do banco (tenants, usuários admin, produtos de exemplo, etc.).
 *
 * Uso na pasta backend:
 *   npm run seed
 *
 * Se o erro for "table does not exist" (P2021), rode antes `npm run db:deploy` ou
 * `npm run seed:deploy` (migrações + seed). Se `migrate deploy` der P3009, rode `npm run db:recover`
 * e depois `npm run seed`. Se após o recover aparecer P3018 ("relation already exists"), o banco está
 * pela metade: `CONFIRM_RESET_PUBLIC_SCHEMA=YES npm run db:reset-public-schema`, depois migrate deploy + seed
 * (apaga todo o schema public; só use se puder perder dados).
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
