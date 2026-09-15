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
  const readme = [
    `Empresa: ${emitente?.razaoSocial || tenant?.name || ""}`,
    `CNPJ: ${emitente?.cnpj || ""}`,
    `Tenant: ${tenant?.slug || tenant?.name || tenantId}`,
    `Período: ${dataInicio} a ${dataFim}`,
    `Data de geração: ${geradoEm}`,
    `Ambiente: ${ambiente === "producao" ? "PRODUÇÃO" : "HOMOLOGAÇÃO / DEMONSTRAÇÃO"}`,
    "",
    `NF-e no período: ${resumo.total}`,
    `NF-e autorizadas: ${resumo.autorizadas}`,
    `NF-e canceladas: ${resumo.canceladas}`,
    `NF-e rejeitadas: ${resumo.rejeitadas}`,
    `NF-e processando: ${resumo.processando}`,
    `Valor autorizado: R$ ${resumo.valorAutorizado.toFixed(2)}`,
    "",
    `XMLs incluídos: ${xmlOk.length}`,
    xmlFalha.length
      ? `XMLs indisponíveis (não incluídos): ${xmlFalha.join(", ")}`
      : "XMLs indisponíveis: nenhum",
    "",
    "Observação:",
    "Este pacote contém os documentos e informações fiscais disponíveis no sistema",
    "para o período informado.",
    "Relatório para conferência e envio à contabilidade.",
    "Não substitui obrigações acessórias ou escrituração fiscal realizada pelo contador.",
    ambiente !== "producao"
      ? "DEMONSTRAÇÃO — SEM VALIDADE FISCAL (ambiente de homologação)."
      : "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const archive = archiver("zip", { zlib: { level: 9 } });
  const zipPromise = streamToBuffer(archive);

  archive.append(xlsxBuf, { name: `${pasta}/relatorio-nfe.xlsx` });
  archive.append(readme, { name: `${pasta}/README.txt` });
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
      name: `${pasta}/canceladas/eventos/resumo-cancelamentos.txt`,
    });
  }

  await archive.finalize();
  const zipBuf = await zipPromise;

  return {
    mimeType: "application/zip",
    filename: `${pasta}.zip`,
    content: zipBuf.toString("base64"),
    encoding: "base64",
    totalLinhas: notas.length,
    truncated: false,
  };
}

module.exports = { processNfePacoteContabil, pastaNome, mesLabel };
