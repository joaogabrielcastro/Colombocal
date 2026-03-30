const { prisma } = require("../src/lib/prisma");

async function main() {
  console.log("Iniciando seed do banco de dados...");

  // Produtos padrão de uma distribuidora de cal
  const produtos = await Promise.all([
    prisma.produto.upsert({
      where: { codigo: "CAL-HID-001" },
      update: {},
      create: {
        nome: "Cal Hidratada CH-I",
        codigo: "CAL-HID-001",
        precoPadrao: 650.0,
        unidade: "ton",
      },
    }),
    prisma.produto.upsert({
      where: { codigo: "CAL-HID-002" },
      update: {},
      create: {
        nome: "Cal Hidratada CH-II",
        codigo: "CAL-HID-002",
        precoPadrao: 580.0,
        unidade: "ton",
      },
    }),
    prisma.produto.upsert({
      where: { codigo: "CAL-VIV-001" },
      update: {},
      create: {
        nome: "Cal Virgem",
        codigo: "CAL-VIV-001",
        precoPadrao: 420.0,
        unidade: "ton",
      },
    }),
  ]);

  console.log(`✅ ${produtos.length} produtos criados`);

  // Vendedor padrão
  const vendedor = await prisma.vendedor.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nome: "Vendedor Interno",
      telefone: "",
      comissaoPercentual: 2.5,
    },
  });

  console.log(`✅ Vendedor padrão criado: ${vendedor.nome}`);

  await prisma.configSistema.upsert({
    where: { chave: "COMISSAO_MODO" },
    create: { chave: "COMISSAO_MODO", valor: "emissao" },
    update: {},
  });
  console.log("✅ Config padrão COMISSAO_MODO=emissao");

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
