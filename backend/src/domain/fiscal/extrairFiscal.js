/**
 * Extrai CFOP/NCM/CST/CSOSN do payload enviado ao provedor (snapshot da emissão).
 * Não inventa alíquotas ICMS/PIS/COFINS — o projeto não as persiste.
 */

function extrairItensFiscaisDoPayload(payloadEnviado) {
  if (!payloadEnviado || typeof payloadEnviado !== "object") return [];
  const items = Array.isArray(payloadEnviado.items) ? payloadEnviado.items : [];
  return items.map((it, idx) => {
    const sit = String(it.icms_situacao_tributaria || "").trim();
    const crtHint = sit.length === 3 && !sit.startsWith("0") ? "csosn" : "cst";
    return {
      numeroItem: it.numero_item || String(idx + 1),
      codigoProduto: it.codigo_produto || null,
      descricao: it.descricao || null,
      cfop: it.cfop || null,
      ncm: it.codigo_ncm || null,
      cst: crtHint === "cst" ? sit || null : null,
      csosn: crtHint === "csosn" || sit.length === 3 ? sit || null : null,
      icmsOrigem: it.icms_origem != null ? String(it.icms_origem) : null,
      quantidade: it.quantidade_comercial ?? null,
      valorBruto: it.valor_bruto != null ? Number(it.valor_bruto) : null,
    };
  });
}

/** Resumo em uma linha para export (CFOPs/NCMs únicos). */
function resumoFiscalLinha(payloadEnviado) {
  const itens = extrairItensFiscaisDoPayload(payloadEnviado);
  const cfops = [...new Set(itens.map((i) => i.cfop).filter(Boolean))];
  const ncms = [...new Set(itens.map((i) => i.ncm).filter(Boolean))];
  const cstCsosn = [
    ...new Set(itens.flatMap((i) => [i.cst, i.csosn].filter(Boolean))),
  ];
  return {
    cfop: cfops.join(", ") || null,
    ncm: ncms.join(", ") || null,
    cstCsosn: cstCsosn.join(", ") || null,
  };
}

module.exports = {
  extrairItensFiscaisDoPayload,
  resumoFiscalLinha,
};
