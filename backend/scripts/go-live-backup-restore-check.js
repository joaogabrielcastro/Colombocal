#!/usr/bin/env node
/**
 * Homologação local de backup/restore + decrypt fiscal (Postgres de teste).
 *
 * Uso (backend/):
 *   npm run go-live:backup-restore-check
 *
 * Não imprime tokens. Não usa Coolify. Evidência local apenas.
 */
require("dotenv").config();
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const {
  encryptFiscalToken,
  decryptFiscalToken,
  isEncryptedFiscalToken,
  getFiscalTokenKeyBytes,
} = require("../src/infra/crypto/fiscalTokenCrypto");

const DB_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:colombocal_dev@127.0.0.1:5436/colombocal_test?schema=public";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], env: process.env });
}

async function main() {
  const key = getFiscalTokenKeyBytes({ required: true });
  const dumpPath = path.join(__dirname, "..", ".tmp-go-live-dump.sql");
  const plain = `go-live-token-${Date.now()}`;
  const cipher = encryptFiscalToken(plain, key);

  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  try {
    let tenant = await prisma.tenant.findFirst({ orderBy: { id: "asc" } });
    if (!tenant) {
      tenant = await prisma.tenant.create({ data: { name: "GoLive", slug: "golive" } });
    }
    await prisma.emitenteFiscal.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        cnpj: "12345678000199",
        inscricaoEstadual: "ISENTO",
        razaoSocial: "GoLive Emitente",
        crt: 1,
        logradouro: "Rua",
        numero: "1",
        bairro: "Centro",
        municipio: "Limeira",
        codigoMunicipio: "3526902",
        uf: "SP",
        cep: "13480000",
        ambiente: "homologacao",
        provedorToken: cipher,
      },
      update: { provedorToken: cipher },
    });

    // Dump via docker exec no container de teste (porta host 5436).
    const dump = run(
      'docker compose -f ../docker-compose.yml exec -T db-test pg_dump -U postgres -d colombocal_test --no-owner --no-acl',
    );
    if (dump.includes(plain)) {
      throw new Error("Dump contém plaintext do token fiscal — falha de segurança");
    }
    if (dump.includes(process.env.FISCAL_TOKEN_ENCRYPTION_KEY || "___none___")) {
      throw new Error("Dump contém FISCAL_TOKEN_ENCRYPTION_KEY — a chave não deve ir no backup");
    }
    fs.writeFileSync(dumpPath, dump, "utf8");

    // Round-trip decrypt na app (mesma chave) após "restore" lógico (dados já no DB).
    const row = await prisma.emitenteFiscal.findUnique({ where: { tenantId: tenant.id } });
    if (!isEncryptedFiscalToken(row.provedorToken)) {
      throw new Error("Token no banco não está no formato cifrado esperado");
    }
    const round = decryptFiscalToken(row.provedorToken, key);
    if (round !== plain) {
      throw new Error("Decrypt após persistência não bate com o original");
    }

    console.log(
      JSON.stringify({
        ok: true,
        dumpBytes: dump.length,
        dumpHasPlaintextToken: false,
        dumpHasEncryptionKey: false,
        decryptAfterPersist: true,
        note: "Chave permanece só no ambiente; dump SQL contém ciphertext.",
      }),
    );
  } finally {
    await prisma.$disconnect();
    try {
      fs.unlinkSync(dumpPath);
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error("go-live:backup-restore-check falhou:", err.message || err);
  process.exit(1);
});
