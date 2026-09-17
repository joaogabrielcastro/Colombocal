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

  const emitente = await prisma.emitenteFiscal.findUnique({ where: { tenantId } });
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true },
  });
  let provider = null;
  try {
    provider = createNfeProvider({ emitente });
  } catch {
    provider = null;
  }
  const pasta = pastaNome(dataInicio);
  const xlsxBuf = await buildXlsxBuffer(rows);

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
            ? `${pasta}/canceladas/${nome}`
            : `${pasta}/xml/${nome}`,
        buffer,
      });
    } else {
      xmlFalha.push(nota.numero || nota.id);
    }
  }

  const geradoEm = new Date().toLocaleString("pt-BR");
  const ambiente = emitente?.ambiente || "homologacao";

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
  let cteProvider = null;
  let mdfeProvider = null;
  try {
    cteProvider = createCteProvider({ emitente });
  } catch {
    cteProvider = null;
  }
  try {
    mdfeProvider = createMdfeProvider({ emitente });
  } catch {
    mdfeProvider = null;
  }

  for (const doc of ctes) {
    if (doc.status !== "autorizada" && doc.status !== "cancelada") continue;
    const nome = `cte-${doc.numero || doc.id}.xml`;
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
      xmlBuffers.push({ path: `${pasta}/cte/${nome}`, buffer });
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
      xmlBuffers.push({ path: `${pasta}/mdfe/${nome}`, buffer });
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
      path: `${pasta}/ciot/ciot-${doc.codigoCiot || doc.id}.txt`,
      buffer: Buffer.from(txt, "utf8"),
    });
  }

  const readme = [
    `Empresa: ${emitente?.razaoSocial || tenant?.name || ""}`,
    `CNPJ: ${emitente?.cnpj || ""}`,
    `Tenant: ${tenant?.slug || tenant?.name || tenantId}`,
    `Período: ${dataInicio} a ${dataFim}`,
    `Data de geração: ${geradoEm}`,
    `Ambiente: ${ambiente === "producao" ? "PRODUÇÃO" : "HOMOLOGAÇÃO / DEMONSTRAÇÃO"}`,
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
    ambiente !== "producao"
      ? "DEMONSTRAÇÃO — SEM VALIDADE FISCAL (ambiente de homologação)."
      : "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const archive = archiver("zip", { zlib: { level: 9 } });
  const zipPromise = streamToBuffer(archive);

  archive.append(xlsxBuf, { name: `${pasta}/relatorios/relatorio-nfe.xlsx` });
  archive.append(xlsxBuf, { name: `${pasta}/nfe/relatorio-nfe.xlsx` });
  archive.append(readme, { name: `${pasta}/README.txt` });
  for (const file of xmlBuffers) {
    const path = file.path.includes("/cte/") ||
      file.path.includes("/mdfe/") ||
      file.path.includes("/ciot/")
      ? file.path
      : file.path.replace(`${pasta}/xml/`, `${pasta}/nfe/xml/`).replace(
          `${pasta}/canceladas/`,
          `${pasta}/nfe/canceladas/`,
        );
    archive.append(file.buffer, { name: path.startsWith(pasta) ? path : file.path });
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
      name: `${pasta}/nfe/canceladas/eventos/resumo-cancelamentos.txt`,
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

module.exports = { processNfePacoteContabil, pastaNome, mesLabel };
