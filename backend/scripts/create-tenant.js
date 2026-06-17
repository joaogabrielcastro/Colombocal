/**
 * Cria um tenant novo + administrador inicial (mesmo banco, dados isolados por tenantId).
 *
 * Uso na pasta backend:
 *   npm run tenant:create -- --name "Distribuidora Sul" --slug distribuidora-sul \
 *     --email admin@sul.com --password "senha123" --admin-name "Maria"
 *
 * Requer DATABASE_URL no .env (ou ambiente).
 */
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env.local"),
  override: false,
});

const { createTenantWithAdmin } = require("../src/services/createTenant");

function getArg(name) {
  const flag = `--${name}`;
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

function usage() {
  console.error(`Uso:
  npm run tenant:create -- --name "Nome da org" [--slug identificador] \\
    --email admin@exemplo.com --password "senha" [--admin-name "Nome"]

Opções:
  --name         Nome da organização (obrigatório)
  --slug         Identificador único (opcional; gerado a partir do nome)
  --email        E-mail do admin (obrigatório; único no sistema)
  --password     Senha do admin (obrigatório, mín. 6 caracteres)
  --admin-name   Nome de exibição do admin (opcional)
`);
  process.exit(1);
}

async function main() {
  const tenantName = getArg("name");
  const tenantSlug = getArg("slug");
  const email = getArg("email");
  const password = getArg("password");
  const adminName = getArg("admin-name");

  if (!tenantName || !email || !password) usage();

  try {
    const { tenant, user } = await createTenantWithAdmin({
      tenantName,
      tenantSlug,
      email,
      password,
      name: adminName,
    });

    console.log("Tenant criado com sucesso.");
    console.log(`  ID:   ${tenant.id}`);
    console.log(`  Nome: ${tenant.name}`);
    console.log(`  Slug: ${tenant.slug}`);
    console.log(`Admin: ${user.email} (id ${user.id})`);
    console.log("\nO administrador pode entrar em /login com o e-mail e senha informados.");
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error("Erro:", msg);
    process.exit(err && err.statusCode ? 1 : 1);
  } finally {
    const { prisma } = require("../lib/prisma");
    await prisma.$disconnect();
  }
}

main();
