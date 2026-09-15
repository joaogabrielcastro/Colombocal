const test = require("node:test");
const assert = require("node:assert/strict");
const { prisma, resetDb, seedTenant } = require("../helpers/testServer");
const {
  isEncryptedFiscalToken,
  decryptFiscalToken,
  encryptFiscalToken,
  getFiscalTokenKeyBytes,
} = require("../../src/infra/crypto/fiscalTokenCrypto");

/**
 * Espelha a lógica de scripts/encrypt-existing-fiscal-tokens.js
 * (sem spawn — evita conflito de engine Prisma no Windows).
 */
async function runBackfillOnce() {
  const key = getFiscalTokenKeyBytes({ required: true });
  let encrypted = 0;
  let skipped = 0;
  const rows = await prisma.emitenteFiscal.findMany({
    select: { id: true, provedorToken: true },
  });
  for (const row of rows) {
    const raw = row.provedorToken;
    if (raw == null || !String(raw).trim()) {
      skipped += 1;
      continue;
    }
    if (isEncryptedFiscalToken(raw)) {
      skipped += 1;
      continue;
    }
    const cipher = encryptFiscalToken(String(raw).trim(), key);
    await prisma.emitenteFiscal.update({
      where: { id: row.id },
      data: { provedorToken: cipher },
    });
    encrypted += 1;
  }
  return { encrypted, skipped, scanned: rows.length };
}

test.beforeEach(async () => {
  await resetDb();
  await seedTenant({ slug: "default", name: "Colombocal" });
});

test("backfill fiscal: plaintext → encrypted → decrypt; 2ª passagem idempotente", async () => {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "default" } });
  const plain = "token-legado-plaintext-xyz";
  await prisma.emitenteFiscal.create({
    data: {
      tenantId: tenant.id,
      cnpj: "12345678000199",
      inscricaoEstadual: "123",
      razaoSocial: "Emitente BF",
      crt: 1,
      logradouro: "Rua",
      numero: "1",
      bairro: "Centro",
      municipio: "Limeira",
      codigoMunicipio: "3526902",
      uf: "SP",
      cep: "13480000",
      ambiente: "homologacao",
      provedorToken: plain,
    },
  });

  const first = await runBackfillOnce();
  assert.equal(first.encrypted, 1);

  const after1 = await prisma.emitenteFiscal.findUnique({ where: { tenantId: tenant.id } });
  assert.ok(isEncryptedFiscalToken(after1.provedorToken));
  assert.ok(!String(after1.provedorToken).includes(plain));
  assert.equal(decryptFiscalToken(after1.provedorToken), plain);
  const cipher1 = after1.provedorToken;

  const second = await runBackfillOnce();
  assert.equal(second.encrypted, 0);
  assert.ok(second.skipped >= 1);

  const after2 = await prisma.emitenteFiscal.findUnique({ where: { tenantId: tenant.id } });
  assert.equal(after2.provedorToken, cipher1);
});
