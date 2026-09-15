#!/usr/bin/env node
/**
 * Criptografa tokens fiscais legados (texto puro) em EmitenteFiscal.provedorToken.
 *
 * Uso:
 *   FISCAL_TOKEN_ENCRYPTION_KEY=... DATABASE_URL=... npm run fiscal:encrypt-existing-tokens
 *
 * Idempotente: registros já no formato v1:... são ignorados.
 * Nunca imprime o token.
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const {
  KEY_ENV,
  getFiscalTokenKeyBytes,
  isEncryptedFiscalToken,
  encryptFiscalToken,
} = require("../src/infra/crypto/fiscalTokenCrypto");

async function main() {
  const key = getFiscalTokenKeyBytes({ required: true });
  const prisma = new PrismaClient();
  let scanned = 0;
  let encrypted = 0;
  let skipped = 0;
  try {
    const rows = await prisma.emitenteFiscal.findMany({
      select: { id: true, tenantId: true, provedorToken: true },
    });
    for (const row of rows) {
      scanned += 1;
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
    console.log(
      JSON.stringify({
        ok: true,
        scanned,
        encrypted,
        skippedAlreadyEncryptedOrEmpty: skipped,
        keyEnv: KEY_ENV,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("fiscal:encrypt-existing-tokens falhou:", err.message || err);
  process.exit(1);
});
