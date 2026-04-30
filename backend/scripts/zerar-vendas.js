/**
 * Remove TODAS as linhas de Venda do banco (ItemVenda e MovimentacaoEstoque
 * ligados à venda são apagados em cascata). Cheques, pagamentos, títulos e
 * fretes que apontavam para a venda ficam com vendaId = null.
 *
 * Uso (na pasta backend):
 *   node scripts/zerar-vendas.js --confirm
 *
 * Faça backup antes. Requer DATABASE_URL (ex.: backend/.env).
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { prisma } = require("../src/lib/prisma");

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error(
      "Este script apaga TODAS as vendas e itens de venda.\n" +
        "Faça backup do banco antes. Para executar:\n" +
        "  node scripts/zerar-vendas.js --confirm\n",
    );
    process.exit(1);
  }

  const antes = await prisma.venda.count();
  const del = await prisma.venda.deleteMany({});
  console.log(
    JSON.stringify(
      {
        ok: true,
        vendasRemovidas: del.count,
        contagemAntes: antes,
        aviso:
          "Pagamentos/títulos/cheques que tinham vendaId podem ter ficado sem vínculo com venda (null).",
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
