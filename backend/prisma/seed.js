const { prisma } = require("../src/lib/prisma");
const bcrypt = require("bcrypt");

const VENDEDOR_PADRAO_NOME = "Vendedor Interno";

/**
 * @param {import("@prisma/client").PrismaClient} db
 * @param {{ slug: string, name: string, adminEmail: string, adminName: string, passwordPlain: string }} cfg
 */
async function seedOneTenant(db, cfg) {
  const tenant = await db.tenant.upsert({
    where: { slug: cfg.slug },
    update: { name: cfg.name },
    create: { name: cfg.name, slug: cfg.slug },
  });

  const passwordHash = await bcrypt.hash(cfg.passwordPlain, 12);
  await db.user.upsert({
    where: { email: cfg.adminEmail },
    update: { passwordHash, tenantId: tenant.id, name: cfg.adminName, role: "admin" },
    create: {
      tenantId: tenant.id,
      email: cfg.adminEmail,
      passwordHash,
      name: cfg.adminName,
      role: "admin",
    },
  });

  const produtos = await Promise.all([
    db.produto.upsert({
      where: { tenantId_codigo: { tenantId: tenant.id, codigo: "CAL-HID-001" } },
      update: {},
      create: {
        tenantId: tenant.id,
        nome: "Cal Hidratada CH-I",
        codigo: "CAL-HID-001",
        precoPadrao: 650.0,
        unidade: "ton",
      },
    }),
    db.produto.upsert({
      where: { tenantId_codigo: { tenantId: tenant.id, codigo: "CAL-HID-002" } },
      update: {},
      create: {
        tenantId: tenant.id,
        nome: "Cal Hidratada CH-II",
        codigo: "CAL-HID-002",
        precoPadrao: 580.0,
        unidade: "ton",
      },
    }),
    db.produto.upsert({
      where: { tenantId_codigo: { tenantId: tenant.id, codigo: "CAL-VIV-001" } },
      update: {},
      create: {
        tenantId: tenant.id,
        nome: "Cal Virgem",
        codigo: "CAL-VIV-001",
        precoPadrao: 420.0,
        unidade: "ton",
      },
    }),
  ]);

  let vendedor = await db.vendedor.findFirst({
    where: { tenantId: tenant.id, nome: VENDEDOR_PADRAO_NOME },
  });
  if (!vendedor) {
    vendedor = await db.vendedor.create({
      data: {
        tenantId: tenant.id,
        nome: VENDEDOR_PADRAO_NOME,
        telefone: "",
        comissaoPercentual: 2.5,
      },
    });
  }

  await db.configSistema.upsert({
    where: { tenantId_chave: { tenantId: tenant.id, chave: "COMISSAO_MODO" } },
    create: { tenantId: tenant.id, chave: "COMISSAO_MODO", valor: "emissao" },
    update: {},
  });

  return { tenant, produtosCount: produtos.length, vendedorId: vendedor.id };
}

async function main() {
  console.log("Iniciando seed do banco de dados...");

  const defaultPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const demoPassword =
    process.env.SEED_DEMO_PASSWORD || process.env.SEED_ADMIN_PASSWORD || "admin123";

  const r1 = await seedOneTenant(prisma, {
    slug: "default",
    name: "Organização padrão",
    adminEmail: "admin@local",
    adminName: "Administrador",
    passwordPlain: defaultPassword,
  });
  console.log(
    `✅ Tenant #${r1.tenant.id} (default): admin@local — defina SEED_ADMIN_PASSWORD em produção`,
  );
  console.log(`   ${r1.produtosCount} produtos, vendedor interno id=${r1.vendedorId}`);

  const r2 = await seedOneTenant(prisma, {
    slug: "demo",
    name: "Demonstração (2º tenant)",
    adminEmail: "demo@local",
    adminName: "Usuário demo",
    passwordPlain: demoPassword,
  });
  console.log(
    `✅ Tenant #${r2.tenant.id} (demo): demo@local — senha: SEED_DEMO_PASSWORD ou mesma de admin`,
  );
  console.log(`   ${r2.produtosCount} produtos, vendedor interno id=${r2.vendedorId}`);

  console.log("✅ Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
