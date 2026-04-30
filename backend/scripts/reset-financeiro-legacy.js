/**
 * Executa o mesmo reset que POST /api/config/reset-financeiro-legacy,
 * sem precisar subir o servidor. Requer confirmação explícita.
 *
 * Uso (na pasta backend):
 *   npm run legacy:reset-financeiro -- --confirm
 *   ou: node scripts/reset-financeiro-legacy.js --confirm
 *   para zerar tudo (sem criar ajustes, removendo também vendas/títulos): node scripts/reset-financeiro-legacy.js --confirm --zerar-total
 *
 * Carrega variáveis de backend/.env (DATABASE_URL).
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { prisma } = require("../src/lib/prisma");
const { executarResetFinanceiroLegacy } = require("../src/services/resetFinanceiroLegacy");

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error(
      "Este script apaga cheques, pagamentos de cheque e ajusta títulos/saldos.\n" +
        "Faça backup do banco antes. Para executar:\n" +
        "  node scripts/reset-financeiro-legacy.js --confirm\n",
    );
    process.exit(1);
  }

  const zerarTotal = process.argv.includes("--zerar-total");
  const result = await executarResetFinanceiroLegacy(prisma, {
    criarAjustes: !zerarTotal,
    zerarPagamentosGerais: zerarTotal,
    zerarVendasETitulos: zerarTotal,
  });
  console.log(JSON.stringify({ success: true, ...result }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
