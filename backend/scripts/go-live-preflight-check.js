#!/usr/bin/env node
/**
 * Pré-voo read-only antes do push/deploy em produção.
 * Não altera dados — só reporta riscos que podem derrubar migrate ou o fluxo diário.
 *
 * Uso (backend/):
 *   DATABASE_URL="postgresql://..." node scripts/go-live-preflight-check.js
 *
 * Exit 0 = ok para seguir (com avisos possíveis).
 * Exit 1 = bloqueador (corrigir antes do migrate/deploy).
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const DB_URL = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
if (!DB_URL) {
  console.error("Defina DATABASE_URL (ou TEST_DATABASE_URL).");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  let blockers = 0;
  let warnings = 0;

  section("1) NF-e duplicadas ativas (bloqueia índice único no migrate)");
  const dups = await prisma.$queryRaw`
    SELECT "tenantId", "vendaId", COUNT(*)::int AS qtd
    FROM "NotaFiscal"
    WHERE "status" IN ('rascunho', 'processando', 'autorizada')
    GROUP BY "tenantId", "vendaId"
    HAVING COUNT(*) > 1
    ORDER BY qtd DESC
    LIMIT 50
  `;
  if (dups.length === 0) {
    console.log("OK — nenhuma venda com mais de uma NF-e ativa.");
  } else {
    blockers += 1;
    console.error(`BLOQUEADOR — ${dups.length} grupo(s) com NF-e ativa duplicada:`);
    for (const row of dups) {
      console.error(`  tenant=${row.tenantId} venda=${row.vendaId} qtd=${row.qtd}`);
    }
  }

  section("2) Emitentes fiscais (token / provedor)");
  let emitentes = [];
  try {
    emitentes = await prisma.emitenteFiscal.findMany({
      select: {
        id: true,
        tenantId: true,
        cnpj: true,
        provedor: true,
        ativo: true,
        padrao: true,
        provedorToken: true,
        ambiente: true,
      },
      orderBy: [{ tenantId: "asc" }, { id: "asc" }],
    });
  } catch (e) {
    warnings += 1;
    console.warn("AVISO — não foi possível ler EmitenteFiscal:", e.message);
  }

  if (emitentes.length === 0) {
    warnings += 1;
    console.warn("AVISO — nenhum emitente cadastrado (NF-e pode falhar).");
  } else {
    for (const e of emitentes) {
      const temToken = !!(e.provedorToken && String(e.provedorToken).trim());
      const flag = !temToken && e.ativo ? "AVISO" : "ok";
      if (!temToken && e.ativo) warnings += 1;
      console.log(
        `${flag} id=${e.id} tenant=${e.tenantId} cnpj=${e.cnpj} provedor=${e.provedor} ambiente=${e.ambiente} ativo=${e.ativo} padrao=${e.padrao} token=${temToken ? "sim" : "NÃO"}`,
      );
    }
    const notaas = emitentes.filter((e) => e.provedor === "notaas" && e.ativo);
    if (notaas.length) {
      warnings += 1;
      console.warn(
        `AVISO — ${notaas.length} emitente(s) ativo(s) em Nôtaas. Só prossiga se a conta Nôtaas estiver homologada.`,
      );
    }
  }

  const focusEnv = !!String(process.env.FOCUS_NFE_TOKEN || "").trim();
  const notaasEnv = !!String(process.env.NOTAAS_API_KEY || "").trim();
  console.log(`Env FOCUS_NFE_TOKEN=${focusEnv ? "definido" : "ausente"} | NOTAAS_API_KEY=${notaasEnv ? "definido" : "ausente"}`);
  if (!focusEnv && emitentes.some((e) => e.ativo && e.provedor === "focusnfe" && !e.provedorToken)) {
    blockers += 1;
    console.error("BLOQUEADOR — Focus ativo sem token no banco e sem FOCUS_NFE_TOKEN no env.");
  }

  section("3) Variáveis de produção sensíveis (somente presença)");
  const checks = [
    ["NODE_ENV", process.env.NODE_ENV],
    ["NFE_WEBHOOK_SECRET", process.env.NFE_WEBHOOK_SECRET ? "(set)" : ""],
    ["BRADESCO_PROVIDER", process.env.BRADESCO_PROVIDER || "(unset→api)"],
    ["SICREDI_PROVIDER", process.env.SICREDI_PROVIDER || "(unset→api)"],
    ["NFE_PROVIDER", process.env.NFE_PROVIDER || "(unset)"],
    ["RUN_PRISMA_MIGRATE_ON_START", process.env.RUN_PRISMA_MIGRATE_ON_START || "(unset)"],
  ];
  for (const [k, v] of checks) console.log(`  ${k}=${v || "(vazio)"}`);
  if (String(process.env.BRADESCO_PROVIDER || "").toLowerCase() === "mock") {
    blockers += 1;
    console.error("BLOQUEADOR — BRADESCO_PROVIDER=mock derruba o boot em produção.");
  }
  if (String(process.env.SICREDI_PROVIDER || "").toLowerCase() === "mock") {
    blockers += 1;
    console.error("BLOQUEADOR — SICREDI_PROVIDER=mock derruba o boot em produção.");
  }
  if (String(process.env.NFE_PROVIDER || "").toLowerCase() === "mock" && process.env.NODE_ENV === "production") {
    warnings += 1;
    console.warn("AVISO — NFE_PROVIDER=mock em produção.");
  }

  section("4) Amostra financeira (somente leitura)");
  try {
    const [vendas, titulos, pagamentos, cheques] = await Promise.all([
      prisma.venda.count(),
      prisma.tituloReceber.count(),
      prisma.pagamento.count(),
      prisma.cheque.count(),
    ]);
    console.log(`Vendas=${vendas} Títulos=${titulos} Pagamentos=${pagamentos} Cheques=${cheques}`);
    console.log("OK — contagens lidas (nenhum dado alterado).");
  } catch (e) {
    warnings += 1;
    console.warn("AVISO — falha ao contar entidades financeiras:", e.message);
  }

  section("Resultado");
  console.log(`Bloqueadores=${blockers} | Avisos=${warnings}`);
  if (blockers > 0) {
    console.error("NÃO siga com migrate/deploy até resolver os bloqueadores.");
    process.exit(1);
  }
  console.log("Pré-voo OK para seguir (revise avisos). Faça backup Postgres antes do deploy.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
