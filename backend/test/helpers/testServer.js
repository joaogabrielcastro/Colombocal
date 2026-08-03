/**
 * Harness de testes de integração.
 *
 * Configura o ambiente (auth desativada, banco de teste, limites altos) ANTES
 * de importar o app Express, e expõe utilitários para resetar/semear o banco.
 *
 * IMPORTANTE: este módulo define process.env.DATABASE_URL para o banco de teste.
 * dotenv (em src/index.js) NÃO sobrescreve variáveis já definidas, então a URL
 * de produção do .env nunca é usada durante os testes.
 */
const { after } = require("node:test");

process.env.NODE_ENV = "test";
process.env.AUTH_DISABLED = "true";
process.env.EXPORT_QUEUE_MODE = "memory";
process.env.DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || "1";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.SETUP_SECRET = process.env.SETUP_SECRET || "test-setup-secret-abc";
process.env.RATE_LIMIT_MAX_PER_WINDOW = "1000000";
process.env.RATE_LIMIT_CNPJ_PER_MIN = "1000000";
process.env.RATE_LIMIT_SETUP_PER_HOUR = "1000000";
process.env.RATE_LIMIT_REGISTER_PER_HOUR = "1000000";
process.env.RATE_LIMIT_LOGIN_PER_WINDOW = "1000000";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:colombocal_dev@localhost:5433/colombocal_test?schema=public";

const request = require("supertest");
const app = require("../../src/index");
const { prisma } = require("../../src/lib/prisma");
const { clearTenantSlugCache } = require("../../src/utils/tenantRequest");

const TABLES = [
  "FinanceiroEvento",
  "ComissaoAjusteVenda",
  "ConfigSistema",
  "FreteMovimento",
  "TituloReceber",
  "Pagamento",
  "Cheque",
  "MovimentacaoEstoque",
  "ItemVenda",
  "Venda",
  "ComissaoClienteProduto",
  "PrecoClienteProduto",
  "Vendedor",
  "Motorista",
  "Produto",
  "Cliente",
  "User",
  "Tenant",
];

async function resetDb() {
  const list = TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
  clearTenantSlugCache();
}

/** Cria um tenant (por padrão slug "default" => frete habilitado). */
async function seedTenant({ slug = "default", name = "Colombocal" } = {}) {
  return prisma.tenant.create({ data: { name, slug } });
}

async function seedVendedor(tenantId, over = {}) {
  return prisma.vendedor.create({
    data: {
      tenantId,
      nome: over.nome || "Representante Teste",
      telefone: over.telefone ?? null,
      comissaoPercentual: over.comissaoPercentual ?? 5,
      ativo: over.ativo ?? true,
    },
  });
}

async function seedMotorista(tenantId, over = {}) {
  return prisma.motorista.create({
    data: {
      tenantId,
      nome: over.nome || "Motorista Teste",
      telefone: over.telefone ?? null,
      veiculo: over.veiculo ?? null,
      placa: over.placa ?? null,
      ativo: over.ativo ?? true,
    },
  });
}

async function seedProduto(tenantId, over = {}) {
  return prisma.produto.create({
    data: {
      tenantId,
      nome: over.nome || "Cal Virgem",
      codigo: over.codigo || `P-${Math.random().toString(36).slice(2, 8)}`,
      precoPadrao: over.precoPadrao ?? 100,
      unidade: over.unidade || "ton",
      pesoKg: over.pesoKg ?? null,
      ativo: over.ativo ?? true,
    },
  });
}

async function seedCliente(tenantId, over = {}) {
  return prisma.cliente.create({
    data: {
      tenantId,
      tipoPessoa: over.tipoPessoa || "PJ",
      cnpj: over.cnpj ?? "11222333000181",
      cpf: over.cpf ?? null,
      razaoSocial: over.razaoSocial || "Cliente Teste LTDA",
      nomeFantasia: over.nomeFantasia ?? "Cliente Teste",
      telefone: over.telefone ?? null,
      cidade: over.cidade ?? null,
      estado: over.estado ?? null,
      endereco: over.endereco ?? null,
      observacoes: over.observacoes ?? null,
      fretePadrao: over.fretePadrao ?? 0,
      fretePadraoSaco: over.fretePadraoSaco ?? 0,
      fretePadraoTonelada: over.fretePadraoTonelada ?? 0,
      vendedorId: over.vendedorId ?? null,
      comissaoFixaPercentual: over.comissaoFixaPercentual ?? null,
      ativo: over.ativo ?? true,
    },
  });
}

/** Cria tenant + representante + cliente + produto num único passo. */
async function seedBase(opts = {}) {
  const tenant = await seedTenant(opts.tenant);
  const vendedor = await seedVendedor(tenant.id, opts.vendedor);
  const cliente = await seedCliente(tenant.id, {
    vendedorId: vendedor.id,
    ...opts.cliente,
  });
  const produto = await seedProduto(tenant.id, opts.produto);
  return { tenant, vendedor, cliente, produto };
}

const agent = request(app);

after(async () => {
  await prisma.$disconnect();
});

module.exports = {
  app,
  prisma,
  agent,
  request,
  resetDb,
  seedTenant,
  seedVendedor,
  seedMotorista,
  seedProduto,
  seedCliente,
  seedBase,
};
