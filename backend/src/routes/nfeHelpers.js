const { prisma } = require("../lib/prisma");
const { AppError } = require("../shared/errors/appError");
const { getTenantSlug } = require("../utils/tenantRequest");
const { getTenantFeatures } = require("../services/tenantFeaturesResolver");

async function assertNfeEnabled(req) {
  const slug = await getTenantSlug(req.tenantId);
  const features = await getTenantFeatures(prisma, req.tenantId, slug);
  if (!features.nfe) {
    throw new AppError("Módulo de NF-e não está habilitado nesta organização.", {
      code: "NFE_DESABILITADA",
      httpStatus: 403,
    });
  }
  return features;
}

function xmlMockDanfe(nota, venda) {
  const chave = nota.chaveAcesso || "0".repeat(44);
  const numero = nota.numero || 0;
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe><infNFe Id="NFe${chave}">
    <ide><nNF>${numero}</nNF><serie>${nota.serie || 1}</serie></ide>
    <infAdic><infCpl>Mock Colombocal — venda #${venda?.numeroVenda || ""}</infCpl></infAdic>
  </infNFe></NFe>
</nfeProc>
`;
}

function htmlDanfeMock(nota, venda) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>DANFE ${nota.numero || ""}</title>
<style>body{font-family:sans-serif;padding:24px;max-width:720px;margin:auto}h1{font-size:18px}.muted{color:#555;font-size:13px}.box{border:1px solid #333;padding:12px;margin-top:12px}</style>
</head><body>
<h1>DANFE — Documento Auxiliar da NF-e (homologação / mock)</h1>
<p class="muted">Sem valor fiscal. Ambiente de testes do Colombocal.</p>
<div class="box">
<p>Venda #${venda?.numeroVenda ?? "—"}</p>
<p>Número: ${nota.numero ?? "—"} · Série: ${nota.serie ?? "—"}</p>
<p>Chave: ${nota.chaveAcesso || "—"}</p>
<p>Protocolo: ${nota.protocolo || "—"}</p>
<p>Status: ${nota.status}</p>
</div>
</body></html>`;
}

module.exports = { assertNfeEnabled, xmlMockDanfe, htmlDanfeMock };
