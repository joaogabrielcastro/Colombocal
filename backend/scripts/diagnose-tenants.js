/**
 * Diagnóstico multi-tenant (somente leitura — não apaga nada).
 *
 * O DATABASE_URL do .env local costuma apontar para o hostname INTERNO do Coolify
 * (ex.: postgresql-database-…), que só funciona DENTRO do servidor/container.
 *
 * Opções:
 *   1) No Coolify → serviço backend → Terminal:
 *        npm run tenant:diagnose
 *      (já usa o banco saas_colombocal do container)
 *
 *   2) Com URL pública/externa do Postgres:
 *        set DATABASE_URL=postgresql://USER:SENHA@HOST:5432/saas_colombocal?schema=public
 *        npm run tenant:diagnose
 */
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env.local"),
  override: false,
});

const { prisma } = require("../src/lib/prisma");

async function main() {
  const url = process.env.DATABASE_URL || "";
  const dbMatch = url.match(/\/([^/?]+)(\?|$)/);
  const dbName = dbMatch ? dbMatch[1] : "(desconhecido)";
  console.log(`\nConectando… database=${dbName}`);
  if (/postgresql-database-/.test(url) && !/localhost|127\.0\.0\.1/.test(url)) {
    console.log(
      "(Se falhar com 'Can't reach database', rode este comando no Terminal do Coolify no container do backend.)",
    );
  }

  const tenants = await prisma.tenant.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, slug: true },
  });

  console.log("\n=== Tenants ===");
  if (!tenants.length) {
    console.log("(nenhum)");
    return;
  }

  for (const t of tenants) {
    const [clientes, vendas, users, cruzados] = await Promise.all([
      prisma.cliente.count({ where: { tenantId: t.id } }),
      prisma.venda.count({ where: { tenantId: t.id } }),
      prisma.user.count({ where: { tenantId: t.id } }),
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS c
        FROM "Venda" v
        INNER JOIN "Cliente" c ON c.id = v."clienteId"
        WHERE v."tenantId" = ${t.id} AND c."tenantId" <> ${t.id}
      `,
    ]);
    const nCruz = Array.isArray(cruzados) && cruzados[0] ? Number(cruzados[0].c) : 0;

    console.log(`\n#${t.id} ${t.name} (slug=${t.slug})`);
    console.log(`  users=${users}  clientes=${clientes}  vendas=${vendas}`);
    console.log(`  vendas com cliente de OUTRO tenant=${nCruz}`);

    const amostraClientes = await prisma.cliente.findMany({
      where: { tenantId: t.id },
      orderBy: { id: "asc" },
      take: 5,
      select: { id: true, razaoSocial: true, nomeFantasia: true },
    });
    if (amostraClientes.length) {
      console.log("  amostra clientes:");
      for (const c of amostraClientes) {
        const fant = c.nomeFantasia ? ` / ${c.nomeFantasia}` : "";
        console.log(`    - [${c.id}] ${c.razaoSocial}${fant}`);
      }
    }

    const amostraVendas = await prisma.venda.findMany({
      where: { tenantId: t.id },
      orderBy: { dataVenda: "desc" },
      take: 5,
      select: {
        id: true,
        numeroVenda: true,
        cliente: { select: { id: true, razaoSocial: true, tenantId: true } },
      },
    });
    if (amostraVendas.length) {
      console.log("  amostra vendas recentes:");
      for (const v of amostraVendas) {
        const cli = v.cliente;
        const mismatch =
          cli && cli.tenantId !== t.id ? ` ⚠ cliente.tenantId=${cli.tenantId}` : "";
        console.log(
          `    - venda #${v.numeroVenda ?? v.id} → cliente [${cli?.id}] ${cli?.razaoSocial || "?"}${mismatch}`,
        );
      }
    }
  }

  console.log("\n=== Fim (nada foi alterado no banco) ===\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
