const { PassThrough } = require("node:stream");
const ExcelJS = require("exceljs");
const archiver = require("archiver");
const { prisma } = require("../../lib/prisma");
const { montarWhereNotas, resumoFiscal, montarLinhaExport, colunasExport } = require("../../domain/fiscal");
const { STATUS } = require("../../domain/nfe/constants");
const { createNfeProvider } = require("../../infra/nfe/provider");
const { xmlMockDanfe } = require("../../routes/nfeHelpers");

function mesLabel(dataInicio) {
  const s = String(dataInicio || "").slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 7);
}

function pastaNome(dataInicio) {
  const [y, m] = String(mesLabel(dataInicio)).split("-");
  const meses = [
    "janeiro",
    "fevereiro",
    "marco",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const mi = Number(m) - 1;
  const nomeMes = meses[mi] || m;
  return `fechamento-${nomeMes}-${y}`;
}

function pastaEmitente(emitente, emitenteFiscalId) {
  const cnpj = String(emitente?.cnpj || "").replace(/\D/g, "");
  if (cnpj.length === 14) return `cnpj-${cnpj}`;
  return emitenteFiscalId ? `_emitente-${emitenteFiscalId}-sem-cnpj` : "_sem-emitente";
}

function providerCache(factory) {
  const cache = new Map();
  return (emitente) => {
    if (!emitente) return null;
    if (cache.has(emitente.id)) return cache.get(emitente.id);
    let provider = null;
    try {
      provider = factory({ emitente });
    } catch {
      provider = null;
    }
    cache.set(emitente.id, provider);
    return provider;
  };
}

async function buildXlsxBuffer(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("NF-e", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(colunasExport);
  for (const row of rows) {
    ws.addRow(colunasExport.map((c) => row[c] ?? ""));
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function streamToBuffer(archive) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const pass = new PassThrough();
    pass.on("data", (c) => chunks.push(c));
    pass.on("end", () => resolve(Buffer.concat(chunks)));
    pass.on("error", reject);
    archive.on("error", reject);
    archive.pipe(pass);
  });
}

async function motivosCancelamentoMap(tenantId, notaIds) {
  if (!notaIds.length) return new Map();
  const eventos = await prisma.financeiroEvento.findMany({
    where: {
      tenantId,
      tipo: "NFE_CANCELADA",
      entidade: "NotaFiscal",
      entidadeId: { in: notaIds },
    },
    orderBy: { createdAt: "desc" },
    select: { entidadeId: true, payload: true },
  });
  const map = new Map();
  for (const ev of eventos) {
    if (map.has(ev.entidadeId)) continue;
    const j = ev.payload?.justificativa;
    if (j) map.set(ev.entidadeId, String(j));
  }
  return map;
}

/**
 * Gera ZIP contábil do período. XML real via provedor; mock só em ambiente de teste/mock.
 */
async function processNfePacoteContabil(payload, jobTenantId) {
  const tenantId = Number(jobTenantId);
  if (!Number.isFinite(tenantId) || tenantId < 1) {
    throw new Error("tenantId inválido no pacote contábil");
  }
  const dataInicio = String(payload.dataInicio || "").trim();
  const dataFim = String(payload.dataFim || "").trim();
  if (!dataInicio || !dataFim) {
    throw new Error("Período obrigatório para pacote contábil");
  }

  const where = montarWhereNotas({ tenantId, dataInicio, dataFim });
  const notas = await prisma.notaFiscal.findMany({
    where,
    include: {
      venda: {
        select: {
          id: true,
          numeroVenda: true,
          valorTotal: true,
          cliente: {
            select: {
              nomeFantasia: true,
              razaoSocial: true,
              cnpj: true,
              cpf: true,
            },
          },
        },
      },
    },
    orderBy: [{ serie: "asc" }, { numero: "asc" }, { id: "asc" }],
  });

  const cancelIds = notas.filter((n) => n.status === STATUS.CANCELADA).map((n) => n.id);
  const motivos = await motivosCancelamentoMap(tenantId, cancelIds);
  const rows = notas.map((n) =>
    montarLinhaExport({ ...n, motivoCancelamento: motivos.get(n.id) || null }),
  );
  const resumo = resumoFiscal(notas);

  const emitentes = await prisma.emitenteFiscal.findMany({
    where: { tenantId },
    orderBy: [{ padrao: "desc" }, { razaoSocial: "asc" }, { id: "asc" }],
  });
  const emitentesById = new Map(emitentes.map((row) => [row.id, row]));
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true },
  });
  const nfeProviderFor = providerCache(createNfeProvider);
  const pasta = pastaNome(dataInicio);
  const xlsxBuf = await buildXlsxBuffer(rows);
  const notasPorPasta = new Map();
  for (const nota of notas) {
    const emitente = emitentesById.get(nota.emitenteFiscalId) || null;
    const key = pastaEmitente(emitente, nota.emitenteFiscalId);
    if (!notasPorPasta.has(key)) notasPorPasta.set(key, []);
    notasPorPasta.get(key).push(nota);
  }

  const xmlOk = [];
  const xmlFalha = [];
  const xmlBuffers = [];

  for (const nota of notas) {
    if (
      nota.status !== STATUS.AUTORIZADA &&
      nota.status !== STATUS.CANCELADA
    ) {
      continue;
    }
    const nome = `nfe-${nota.numero || nota.id}.xml`;
    const emitente = emitentesById.get(nota.emitenteFiscalId) || null;
    const pastaEmpresa = pastaEmitente(emitente, nota.emitenteFiscalId);
    const provider = nfeProviderFor(emitente);
    let buffer = null;
    if (nota.xmlUrl && provider?.baixarArquivo) {
      try {
        const file = await provider.baixarArquivo(nota.xmlUrl);
        if (file?.buffer) buffer = Buffer.from(file.buffer);
      } catch {
        /* registrada abaixo */
      }
    }
    if (!buffer && process.env.NFE_PROVIDER === "mock") {
      buffer = Buffer.from(
        xmlMockDanfe(nota, { numeroVenda: nota.venda?.numeroVenda }),
        "utf8",
      );
    }
    if (buffer) {
      xmlOk.push(nota.numero || nota.id);
      xmlBuffers.push({
        path:
          nota.status === STATUS.CANCELADA
            ? `${pasta}/${pastaEmpresa}/nfe/canceladas/${nome}`
            : `${pasta}/${pastaEmpresa}/nfe/xml/${nome}`,
        buffer,
      });
    } else {
      xmlFalha.push(nota.numero || nota.id);
    }
  }

  const geradoEm = new Date().toLocaleString("pt-BR");
  const ambientes = [...new Set(emitentes.map((row) => row.ambiente).filter(Boolean))];
  const ambiente = ambientes.length === 1 ? ambientes[0] : ambientes.length > 1 ? "misto" : "homologacao";

  const range = require("../../utils/dateRangeQuery").getDateRange(dataInicio, dataFim);
  const periodFilter = range.gte || range.lte ? range : undefined;

  const [ctes, mdfes, ciots] = await Promise.all([
    prisma.conhecimentoTransporte.findMany({
      where: {
        tenantId,
        ...(periodFilter ? { emitidaEm: periodFilter } : {}),
      },
    }),
    prisma.manifestoEletronico.findMany({
      where: {
        tenantId,
        ...(periodFilter ? { emitidaEm: periodFilter } : {}),
      },
    }),
    prisma.operacaoCiot.findMany({
      where: {
        tenantId,
        ...(periodFilter ? { dataOperacao: periodFilter } : {}),
      },
    }),
  ]);

  const { resumoFiscalMulti } = require("../../domain/fiscal");
  const multi = resumoFiscalMulti({ notas, ctes, mdfes, ciots });

  const cteXmlFalha = [];
  const mdfeXmlFalha = [];
  const ciotSemComprovante = [];

  const { createCteProvider } = require("../../infra/cte/provider");
  const { createMdfeProvider } = require("../../infra/mdfe/provider");
  const cteProviderFor = providerCache(createCteProvider);
  const mdfeProviderFor = providerCache(createMdfeProvider);

  for (const doc of ctes) {
    if (doc.status !== "autorizada" && doc.status !== "cancelada") continue;
    const nome = `cte-${doc.numero || doc.id}.xml`;
    const emitente = emitentesById.get(doc.emitenteFiscalId) || null;
    const pastaEmpresa = pastaEmitente(emitente, doc.emitenteFiscalId);
    const cteProvider = cteProviderFor(emitente);
    let buffer = null;
    if (doc.xmlUrl && cteProvider?.baixarArquivo) {
      try {
        const file = await cteProvider.baixarArquivo(doc.xmlUrl);
        if (file?.buffer) buffer = Buffer.from(file.buffer);
      } catch {
        /* below */
      }
    }
    if (buffer) {
      xmlBuffers.push({ path: `${pasta}/${pastaEmpresa}/cte/${nome}`, buffer });
    } else {
      cteXmlFalha.push(doc.numero || doc.id);
    }
  }

  for (const doc of mdfes) {
    if (
      doc.status !== "autorizada" &&
      doc.status !== "cancelada" &&
      doc.status !== "encerrada"
    ) {
      continue;
    }
    const nome = `mdfe-${doc.numero || doc.id}.xml`;
    const emitente = emitentesById.get(doc.emitenteFiscalId) || null;
    const pastaEmpresa = pastaEmitente(emitente, doc.emitenteFiscalId);
    const mdfeProvider = mdfeProviderFor(emitente);
    let buffer = null;
    if (doc.xmlUrl && mdfeProvider?.baixarArquivo) {
      try {
        const file = await mdfeProvider.baixarArquivo(doc.xmlUrl);
        if (file?.buffer) buffer = Buffer.from(file.buffer);
      } catch {
        /* below */
      }
    }
    if (buffer) {
      xmlBuffers.push({ path: `${pasta}/${pastaEmpresa}/mdfe/${nome}`, buffer });
    } else {
      mdfeXmlFalha.push(doc.numero || doc.id);
    }
  }

  for (const doc of ciots) {
    if (!doc.codigoCiot) {
      ciotSemComprovante.push(doc.id);
      continue;
    }
    const txt = [
      `CIOT: ${doc.codigoCiot}`,
      `Verificador: ${doc.codigoVerificador || ""}`,
      `Status: ${doc.status}`,
      `Provider: ${doc.provider}`,
      `Transportador: ${doc.transportadorNome || ""}`,
      `Valor: ${doc.valorOperacao != null ? Number(doc.valorOperacao) : ""}`,
      doc.status === "nao_implementado" || doc.provider === "mock"
        ? "ATENÇÃO: registro de demonstração / sem integração IPEF real."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    xmlBuffers.push({
      path: `${pasta}/_sem-emitente/ciot/ciot-${doc.codigoCiot || doc.id}.txt`,
      buffer: Buffer.from(txt, "utf8"),
    });
  }

  const readme = [
    `Empresa/tenant: ${tenant?.name || ""}`,
    `Tenant: ${tenant?.slug || tenant?.name || tenantId}`,
    `Emitentes configurados: ${emitentes.length}`,
    ...emitentes.map((row) =>
      `- ${row.razaoSocial} | CNPJ ${row.cnpj} | ${row.ambiente} | pasta ${pastaEmitente(row, row.id)}`,
    ),
    `Período: ${dataInicio} a ${dataFim}`,
    `Data de geração: ${geradoEm}`,
    `Ambiente: ${ambiente === "producao" ? "PRODUÇÃO" : ambiente === "misto" ? "MISTO" : "HOMOLOGAÇÃO / DEMONSTRAÇÃO"}`,
    "",
    "=== NF-e ===",
    `Total: ${resumo.total} | Autorizadas: ${resumo.autorizadas} | Canceladas: ${resumo.canceladas} | Rejeitadas: ${resumo.rejeitadas}`,
    `Valor autorizado (NF-e): R$ ${resumo.valorAutorizado.toFixed(2)}`,
    `XMLs NF-e incluídos: ${xmlOk.length}`,
    xmlFalha.length
      ? `XMLs NF-e indisponíveis: ${xmlFalha.join(", ")}`
      : "XMLs NF-e indisponíveis: nenhum",
    "",
    "=== CT-e ===",
    `Total: ${multi.cte.total} | Autorizados: ${multi.cte.autorizadas} | Cancelados: ${multi.cte.canceladas}`,
    `Valor serviço autorizado (CT-e): R$ ${multi.cte.valorServicoAutorizado.toFixed(2)}`,
    cteXmlFalha.length
      ? `XMLs CT-e indisponíveis: ${cteXmlFalha.join(", ")}`
      : "XMLs CT-e indisponíveis: nenhum",
    "",
    "=== MDF-e ===",
    `Total: ${multi.mdfe.total} | Autorizados: ${multi.mdfe.autorizadas} | Encerrados: ${multi.mdfe.encerradas} | Cancelados: ${multi.mdfe.canceladas}`,
    mdfeXmlFalha.length
      ? `XMLs MDF-e indisponíveis: ${mdfeXmlFalha.join(", ")}`
      : "XMLs MDF-e indisponíveis: nenhum",
    "",
    "=== CIOT ===",
    `Total: ${multi.ciot.total} | Registrados: ${multi.ciot.registrados} | Cancelados: ${multi.ciot.cancelados}`,
    `Valor registrado (CIOT): R$ ${multi.ciot.valorRegistrado.toFixed(2)}`,
    ciotSemComprovante.length
      ? `CIOT sem código/comprovante: ${ciotSemComprovante.join(", ")}`
      : "CIOT sem comprovante: nenhum",
    "",
    "Observação:",
    "Valores de tipos diferentes NÃO devem ser somados em um único total contábil.",
    "XML/DACTE/DAMDFE só entram quando disponíveis no provedor — nenhum arquivo falso.",
    "Relatório para conferência. Não substitui obrigações acessórias do contador.",
    "Documentos sem emitente vinculado ficam em _sem-emitente e exigem conciliação manual.",
    ambiente !== "producao"
      ? "DEMONSTRAÇÃO — SEM VALIDADE FISCAL (ambiente de homologação)."
      : "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const archive = archiver("zip", { zlib: { level: 9 } });
  const zipPromise = streamToBuffer(archive);

  archive.append(xlsxBuf, { name: `${pasta}/relatorios/relatorio-nfe.xlsx` });
  archive.append(readme, { name: `${pasta}/README.txt` });
  for (const emitente of emitentes) {
    const pastaEmpresa = pastaEmitente(emitente, emitente.id);
    const notasEmpresa = notasPorPasta.get(pastaEmpresa) || [];
    const rowsEmpresa = notasEmpresa.map((nota) =>
      montarLinhaExport({ ...nota, motivoCancelamento: motivos.get(nota.id) || null }),
    );
    archive.append(await buildXlsxBuffer(rowsEmpresa), {
      name: `${pasta}/${pastaEmpresa}/relatorios/relatorio-nfe.xlsx`,
    });
    archive.append(
      [
        `Razão social: ${emitente.razaoSocial}`,
        `Nome fantasia: ${emitente.nomeFantasia || ""}`,
        `CNPJ: ${emitente.cnpj}`,
        `Ambiente: ${emitente.ambiente}`,
        `NF-e no período: ${notasEmpresa.length}`,
      ].join("\n"),
      { name: `${pasta}/${pastaEmpresa}/README.txt` },
    );
  }
  if (notasPorPasta.has("_sem-emitente") || ciots.length > 0) {
    const notasSemEmitente = notasPorPasta.get("_sem-emitente") || [];
    const rowsSemEmitente = notasSemEmitente.map((nota) =>
      montarLinhaExport({ ...nota, motivoCancelamento: motivos.get(nota.id) || null }),
    );
    archive.append(await buildXlsxBuffer(rowsSemEmitente), {
      name: `${pasta}/_sem-emitente/relatorios/relatorio-nfe.xlsx`,
    });
    archive.append(
      "Documentos sem empresa emissora vinculada. Concilie antes de entregar o pacote contábil.",
      { name: `${pasta}/_sem-emitente/README.txt` },
    );
  }
  for (const file of xmlBuffers) {
    archive.append(file.buffer, { name: file.path });
  }
  if (resumo.canceladas > 0) {
    const cancelMeta = notas
      .filter((n) => n.status === STATUS.CANCELADA)
      .map((n) =>
        [
          `NF ${n.numero || n.id}`,
          `Série: ${n.serie ?? ""}`,
          `Chave: ${n.chaveAcesso || ""}`,
          `Cancelada em: ${n.canceladaEm ? new Date(n.canceladaEm).toLocaleString("pt-BR") : ""}`,
          `Motivo: ${motivos.get(n.id) || n.motivoRejeicao || ""}`,
          `Protocolo: ${n.protocolo || ""}`,
          "",
        ].join("\n"),
      )
      .join("\n");
    archive.append(cancelMeta || "Sem detalhes.", {
      name: `${pasta}/relatorios/resumo-cancelamentos.txt`,
    });
  }

  await archive.finalize();
  const zipBuf = await zipPromise;

  return {
    mimeType: "application/zip",
    filename: `${pasta}.zip`,
    content: zipBuf.toString("base64"),
    encoding: "base64",
    totalLinhas: notas.length + ctes.length + mdfes.length + ciots.length,
    truncated: false,
  };
}

module.exports = { processNfePacoteContabil, pastaEmitente, pastaNome, mesLabel };
