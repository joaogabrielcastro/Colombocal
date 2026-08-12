/**
 * Remove vendas de um tenant (ou de todos, se não passar --tenant).
 * ItemVenda e MovimentacaoEstoque ligados à venda saem em cascata.
 * Títulos/pagamentos/cheques da venda ficam com vendaId = null (a menos que
 * use --com-titulos, que apaga títulos daquele tenant).
 *
 * Uso (na pasta backend, ou: docker compose exec backend …):
 *   node scripts/zerar-vendas.js --tenant=requinte --confirm
 *   node scripts/zerar-vendas.js --tenant=requinte --confirm --com-titulos
 *   node scripts/zerar-vendas.js --confirm   # TODOS os tenants — cuidado
 *
 * Faça backup antes. Requer DATABASE_URL (ex.: backend/.env).
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { prisma } = require("../src/lib/prisma");

function argValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return null;
  return hit.slice(prefix.length).trim() || null;
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error(
      "Este script apaga vendas.\n" +
        "Faça backup do banco antes. Exemplos:\n" +
        "  node scripts/zerar-vendas.js --tenant=requinte --confirm\n" +
        "  node scripts/zerar-vendas.js --tenant=requinte --confirm --com-titulos\n",
    );
    process.exit(1);
  }

  const slug = argValue("--tenant=");
  const tenantIdArg = argValue("--tenant-id=");
  const comTitulos = process.argv.includes("--com-titulos");

  let tenantFilter = {};
  let tenantInfo = null;

  if (slug || tenantIdArg) {
    const where = slug
      ? { slug: String(slug).toLowerCase() }
      : { id: Number(tenantIdArg) };
    tenantInfo = await prisma.tenant.findFirst({ where });
    if (!tenantInfo) {
      console.error("Tenant não encontrado:", slug || tenantIdArg);
      process.exit(1);
    }
    tenantFilter = { tenantId: tenantInfo.id };
  }

  const antes = await prisma.venda.count({ where: tenantFilter });
  let titulosRemovidos = 0;

  if (comTitulos && tenantInfo) {
    const delTit = await prisma.tituloReceber.deleteMany({
      where: { tenantId: tenantInfo.id },
    });
    titulosRemovidos = delTit.count;
  }

  const del = await prisma.venda.deleteMany({ where: tenantFilter });

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenant: tenantInfo
          ? { id: tenantInfo.id, slug: tenantInfo.slug, name: tenantInfo.name }
          : "TODOS",
        vendasRemovidas: del.count,
        contagemAntes: antes,
        titulosRemovidos,
        aviso: comTitulos
          ? "Títulos do tenant também foram apagados."
          : "Títulos/pagamentos/cheques que tinham vendaId podem ter ficado sem vínculo (null).",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
