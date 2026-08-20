#!/usr/bin/env node
/**
 * Redefine senha de um usuário por e-mail (tenant Colombocal / qualquer).
 *
 * Uso (no container do backend / com DATABASE_URL):
 *   node scripts/reset-user-password.js edgard@colombocal.com '060419'
 *   node scripts/reset-user-password.js edgard@colombocal.com '060419' --tenant=default
 */
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

async function main() {
  const email = String(process.argv[2] || "")
    .trim()
    .toLowerCase();
  const password = String(process.argv[3] || "");
  const tenantArg = process.argv.find((a) => a.startsWith("--tenant="));
  const tenantSlug = tenantArg
    ? String(tenantArg.split("=")[1] || "")
        .trim()
        .toLowerCase()
    : "";

  if (!email || !password) {
    console.error(
      "Uso: node scripts/reset-user-password.js <email> <senha> [--tenant=slug]",
    );
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Senha deve ter pelo menos 6 caracteres");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const where = { email };
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, slug: true, name: true },
      });
      if (!tenant) {
        console.error(`Tenant não encontrado: ${tenantSlug}`);
        process.exit(1);
      }
      where.tenantId = tenant.id;
    }

    const users = await prisma.user.findMany({
      where,
      include: { tenant: { select: { id: true, slug: true, name: true } } },
    });
    if (users.length === 0) {
      console.error(`Usuário não encontrado: ${email}`);
      process.exit(1);
    }
    if (users.length > 1 && !tenantSlug) {
      console.error(
        "Há mais de um usuário com este e-mail. Use --tenant=default ou --tenant=colombocal",
      );
      for (const u of users) {
        console.error(`  - id=${u.id} tenant=${u.tenant.slug} (${u.tenant.name})`);
      }
      process.exit(1);
    }

    const user = users[0];
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    console.log(
      `Senha atualizada: ${user.email} (id=${user.id}, tenant=${user.tenant.slug})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
