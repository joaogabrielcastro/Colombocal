const { prisma } = require("../lib/prisma");
const { findManyBatched, EXPORT_MAX_ROWS } = require("./exportBatch");
const { buildVendasWhere, buildTitulosWhere } = require("../utils/relatorioWhere");
const { listarClientesDevedores } = require("./financeiroDevedores");

/**
 * Paridade com frontend formatFreteReciboLinha (utils.ts).
 * @param {{ frete?: unknown, freteRecibo?: boolean, fretes?: Array<{ reciboEmitido?: boolean, reciboData?: Date|string|null }> }} v
 */
function formatFretePagoCsv(v) {
  const freteVal = parseFloat(String(v.frete ?? 0));
  const f = Array.isArray(v.fretes) ? v.fretes[0] : null;
  if ((!Number.isFinite(freteVal) || freteVal <= 0) && !f) return "—";
  const dataStr = f?.reciboData
    ? new Date(f.reciboData).toLocaleDateString("pt-BR")
    : "";
  const pago = !!(f?.reciboEmitido || v.freteRecibo);
  if (!pago && freteVal > 0) return "Pagamento pendente";
  if (pago && dataStr) return `Pago em ${dataStr}`;
  if (pago) return "Pago";
  return "—";
}

const FINANCEIRO_CSV_HEADER =
  "Cliente,Original (titulos),Pago (titulos),Em aberto (titulos)";
const TITULOS_CSV_HEADER =
  "Título,Cliente,Venda,Vencimento,Valor Original,Valor Pago,Valor em Aberto,Status";

async function processVendasCsv(payload) {
  const tenantId = parseInt(payload.tenantId, 10);
  const where = buildVendasWhere(payload, tenantId);
  const { rows: vendas, truncated } = await findManyBatched(
    (args) => prisma.venda.findMany(args),
    {
      where,
      include: {
        cliente: { select: { nomeFantasia: true, razaoSocial: true } },
        vendedor: { select: { nome: true } },
        fretes: {
          take: 1,
          orderBy: { id: "asc" },
          select: { reciboEmitido: true, reciboData: true },
        },
      },
      orderBy: [{ dataVenda: "desc" }, { id: "desc" }],
    },
  );

  // Mesmas colunas do CSV/Excel no frontend (relatorios-vendas/services/exports.ts).
  const header = "Ordem,Data,Cliente,Vendedor,Valor Total,Frete,Frete pago\n";
  const lines = [];
  for (const v of vendas) {
    const ordem = v.numeroVenda != null && v.numeroVenda > 0 ? v.numeroVenda : v.id;
    lines.push(
      [
        ordem,
        new Date(v.dataVenda).toLocaleDateString("pt-BR"),
        String(v.cliente.nomeFantasia || v.cliente.razaoSocial || "").replaceAll('"', '""'),
        String(v.vendedor.nome || "").replaceAll('"', '""'),
        parseFloat(String(v.valorTotal || 0)).toFixed(2),
        parseFloat(String(v.frete || 0)).toFixed(2),
        formatFretePagoCsv(v).replaceAll('"', '""'),
      ]
        .map((x) => `"${x}"`)
        .join(","),
    );
  }

  const periodoIni = payload.dataInicio || "inicio";
  const periodoFim = payload.dataFim || "fim";
  return {
    mimeType: "text/csv;charset=utf-8",
    filename: `relatorio-vendas-${periodoIni}-${periodoFim}.csv`,
    content: "\uFEFF" + header + lines.join("\n"),
    totalLinhas: vendas.length,
    truncated,
    maxLinhas: EXPORT_MAX_ROWS,
  };
}

async function processFinanceiroCsv(_payload, tenantId) {
  const { clientesDevedores: capped, truncated } = await listarClientesDevedores(tenantId);
  // Colunas = carteira de títulos (SSOT de cobrança), não conta corrente vendas−pagamentos.
  const csv =
    `${FINANCEIRO_CSV_HEADER}\n` +
    capped
      .map(
        (c) =>
          `"${String(c.cliente.nomeFantasia || c.cliente.razaoSocial).replaceAll('"', '""')}",${c.debito.toFixed(2)},${c.credito.toFixed(2)},${c.saldo.toFixed(2)}`,
      )
      .join("\n");

  return {
    mimeType: "text/csv;charset=utf-8",
    filename: `financeiro-devedores_${new Date().toISOString().slice(0, 10)}.csv`,
    content: "\uFEFF" + csv,
    totalLinhas: capped.length,
    truncated,
    maxLinhas: EXPORT_MAX_ROWS,
  };
}

async function processTitulosCsv(payload) {
  const tenantId = parseInt(payload.tenantId, 10);
  const where = buildTitulosWhere(payload, tenantId);
  const { rows: titulos, truncated } = await findManyBatched(
    (args) => prisma.tituloReceber.findMany(args),
    {
      where,
      include: {
        cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        venda: { select: { id: true, numeroVenda: true, dataVenda: true, valorTotal: true } },
      },
      orderBy: [{ vencimento: "asc" }, { id: "desc" }],
    },
  );

  const header = TITULOS_CSV_HEADER;
  const bodyLines = [];
  for (const t of titulos) {
    const original = parseFloat(String(t.valorOriginal || 0));
    const pago = parseFloat(String(t.valorPago || 0));
    const aberto = Math.max(0, original - pago);
    const cols = [
      t.numero || `#${t.id}`,
      t.cliente.nomeFantasia || t.cliente.razaoSocial,
      t.venda ? `Venda #${t.venda.numeroVenda ?? t.venda.id}` : "-",
      new Date(t.vencimento).toLocaleDateString("pt-BR"),
      original.toFixed(2),
      pago.toFixed(2),
      aberto.toFixed(2),
      t.status,
    ];
    bodyLines.push(cols.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","));
  }

  return {
    mimeType: "text/csv;charset=utf-8",
    filename: `titulos_${new Date().toISOString().slice(0, 10)}.csv`,
    content: "\uFEFF" + header + "\n" + bodyLines.join("\n"),
    totalLinhas: titulos.length,
    truncated,
    maxLinhas: EXPORT_MAX_ROWS,
  };
}

const PROCESSORS = {
  vendas_csv: (payload, tenantId) => processVendasCsv(payload, tenantId),
  financeiro_csv: (payload, tenantId) => processFinanceiroCsv(payload, tenantId),
  titulos_csv: (payload, tenantId) => processTitulosCsv(payload, tenantId),
};

async function runExportProcessor(type, tenantId, payload = {}) {
  const fn = PROCESSORS[type];
  if (!fn) {
    throw new Error(`Processador de export desconhecido: ${type}`);
  }
  return fn(payload, tenantId);
}

module.exports = {
  runExportProcessor,
  PROCESSORS,
  formatFretePagoCsv,
  processVendasCsv,
  FINANCEIRO_CSV_HEADER,
  TITULOS_CSV_HEADER,
};
