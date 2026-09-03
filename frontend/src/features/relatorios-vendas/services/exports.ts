"use client";

import * as XLSX from "xlsx";
import {
  formatDate,
  formatFreteReciboLinha,
  formatMoney,
  vendaNumeroPublico,
} from "@/lib/utils";
import { escapeHtml } from "@/lib/html";
import type { RelVendas } from "../types";
import type {
  ResumoCliente,
  ResumoProduto,
  ResumoRepresentante,
} from "./resumo";

export type RelatorioVendasPdfSecao =
  | "totais"
  | "representantes"
  | "clientes"
  | "produtos"
  | "detalhes";

export const RELATORIO_VENDAS_PDF_SECOES: {
  id: RelatorioVendasPdfSecao;
  label: string;
}[] = [
  { id: "totais", label: "Resumo geral (totais)" },
  { id: "representantes", label: "Por representante" },
  { id: "clientes", label: "Por cliente" },
  { id: "produtos", label: "Por produto" },
  { id: "detalhes", label: "Detalhamento das vendas" },
];

function periodoLabel(dataInicio: string, dataFim: string) {
  const ini = dataInicio
    ? new Date(dataInicio + "T12:00:00").toLocaleDateString("pt-BR")
    : "—";
  const fim = dataFim
    ? new Date(dataFim + "T12:00:00").toLocaleDateString("pt-BR")
    : "—";
  return `${ini} a ${fim}`;
}

const PDF_STYLES = `
  body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
  h1 { font-size: 18px; margin: 0 0 4px 0; }
  h2 { font-size: 14px; margin: 28px 0 8px 0; page-break-after: avoid; }
  h2:first-of-type { margin-top: 16px; }
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
  .hint { margin-top: 16px; font-size: 10px; color: #666; }
  .secao { page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
  th { background: #f3f4f6; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.ordem, th.ordem { font-weight: 700; color: #1d4ed8; font-family: ui-monospace, monospace; white-space: nowrap; }
  .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .kpi label { display: block; font-size: 11px; color: #6b7280; }
  .kpi strong { font-size: 18px; }
  @media print {
    h2 { page-break-before: auto; }
    .secao-detalhes { page-break-before: always; }
  }
`;

function abrirImpressaoPdf(titulo: string, corpo: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titulo)}</title>
  <style>${PDF_STYLES}</style>
</head>
<body>
  ${corpo}
  <p class="hint">No diálogo de impressão, escolha &quot;Salvar como PDF&quot;.</p>
</body>
</html>`);
  w.document.close();
  w.focus();
  w.print();
}

function cabecalhoSecao(titulo: string, dataInicio: string, dataFim: string) {
  return `<h1>${escapeHtml(titulo)}</h1>
  <p class="meta">Período: ${escapeHtml(periodoLabel(dataInicio, dataFim))} · Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</p>`;
}

export type ExportarPdfSecaoOpts = {
  data: RelVendas;
  dataInicio: string;
  dataFim: string;
  resumoRepresentantes: ResumoRepresentante[];
  resumoClientes: ResumoCliente[];
  resumoProdutos: ResumoProduto[];
  freteEnabled?: boolean;
};

function htmlTotais(data: RelVendas, freteEnabled: boolean) {
  const totalRegistros = data.totalRegistros ?? data.quantidade;
  const ticket = totalRegistros > 0 ? data.totalFaturamento / totalRegistros : 0;
  const freteKpi = freteEnabled
    ? `<div class="kpi"><label>Frete total</label><strong>${escapeHtml(formatMoney(data.totalFrete ?? 0))}</strong></div>`
    : "";
  return `<div class="secao">
    <h2>Resumo geral</h2>
    <div class="kpis">
      <div class="kpi"><label>Vendas no período</label><strong>${totalRegistros}</strong></div>
      <div class="kpi"><label>Total vendido</label><strong>${escapeHtml(formatMoney(data.totalFaturamento))}</strong></div>
      ${freteKpi}
      <div class="kpi"><label>Ticket médio</label><strong>${totalRegistros > 0 ? escapeHtml(formatMoney(ticket)) : "—"}</strong></div>
    </div>
  </div>`;
}

function htmlRepresentantes(reps: ResumoRepresentante[]) {
  const rows = reps
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.nome)}</td>
        <td class="num">${r.quantidade}</td>
        <td class="num">${r.participacao.toFixed(2)}%</td>
        <td class="num">${escapeHtml(formatMoney(r.total))}</td>
      </tr>`,
    )
    .join("");
  return `<div class="secao">
    <h2>Por representante</h2>
    <table>
      <thead><tr>
        <th>Representante</th><th class="num">Qtd</th><th class="num">Part. %</th><th class="num">Total</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#666">Sem dados no período.</td></tr>`}</tbody>
    </table>
  </div>`;
}

function htmlClientes(clientes: ResumoCliente[]) {
  const rows = clientes
    .map(
      (c) => `<tr>
        <td>${escapeHtml(c.nome)}</td>
        <td class="num">${c.quantidade}</td>
        <td class="num">${escapeHtml(formatMoney(c.total))}</td>
      </tr>`,
    )
    .join("");
  return `<div class="secao">
    <h2>Por cliente</h2>
    <table>
      <thead><tr><th>Cliente</th><th class="num">Qtd</th><th class="num">Total</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="3" style="text-align:center;color:#666">Sem dados no período.</td></tr>`}</tbody>
    </table>
  </div>`;
}

function htmlProdutos(produtos: ResumoProduto[]) {
  const rows = produtos
    .map(
      (p) => `<tr>
        <td>${escapeHtml(p.nome)}</td>
        <td class="num">${escapeHtml(p.quantidade.toLocaleString("pt-BR"))} ${escapeHtml(p.unidade)}</td>
        <td class="num">${escapeHtml(formatMoney(p.total))}</td>
      </tr>`,
    )
    .join("");
  return `<div class="secao">
    <h2>Por produto</h2>
    <table>
      <thead><tr><th>Produto</th><th class="num">Quantidade</th><th class="num">Total</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="3" style="text-align:center;color:#666">Sem dados no período.</td></tr>`}</tbody>
    </table>
  </div>`;
}

function htmlDetalhes(data: RelVendas, freteEnabled: boolean) {
  const freteHead = freteEnabled
    ? `<th class="num">Frete</th><th>Frete pago</th>`
    : "";
  const rows = data.vendas
    .map((v) => {
      const freteCols = freteEnabled
        ? `<td class="num">${escapeHtml(formatMoney(v.frete))}</td><td>${escapeHtml(formatFreteReciboLinha(v))}</td>`
        : "";
      return `<tr>
        <td class="ordem">#${vendaNumeroPublico(v)}</td>
        <td>${escapeHtml(formatDate(v.dataVenda))}</td>
        <td>${escapeHtml(v.cliente.nomeFantasia || v.cliente.razaoSocial)}</td>
        <td>${escapeHtml(v.vendedor.nome)}</td>
        ${freteCols}
        <td class="num">${escapeHtml(formatMoney(v.valorTotal))}</td>
      </tr>`;
    })
    .join("");
  const colspan = freteEnabled ? 7 : 5;
  return `<div class="secao secao-detalhes">
    <h2>Detalhamento das vendas</h2>
    <table>
      <thead><tr>
        <th class="ordem">Ordem</th><th>Data</th><th>Cliente</th><th>Vendedor</th>
        ${freteHead}
        <th class="num">Total</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="${colspan}" style="text-align:center;color:#666">Sem vendas no período.</td></tr>`}</tbody>
    </table>
  </div>`;
}

/** PDF com todas as seções — ideal para enviar ao cliente. */
export function exportarRelatorioVendasPdfCompleto(opts: ExportarPdfSecaoOpts) {
  const { data, dataInicio, dataFim } = opts;
  const freteEnabled = opts.freteEnabled !== false;
  const corpo = `${cabecalhoSecao("Relatório de Vendas — Completo", dataInicio, dataFim)}
    ${htmlTotais(data, freteEnabled)}
    ${htmlRepresentantes(opts.resumoRepresentantes)}
    ${htmlClientes(opts.resumoClientes)}
    ${htmlProdutos(opts.resumoProdutos)}
    ${htmlDetalhes(data, freteEnabled)}`;
  abrirImpressaoPdf("Relatório de Vendas — Completo", corpo);
}

export function exportarRelatorioVendasPdfSecao(
  secao: RelatorioVendasPdfSecao,
  opts: ExportarPdfSecaoOpts,
) {
  const { data, dataInicio, dataFim } = opts;
  const freteEnabled = opts.freteEnabled !== false;

  switch (secao) {
    case "totais":
      abrirImpressaoPdf(
        "Relatório de Vendas — Resumo geral",
        `${cabecalhoSecao("Relatório de Vendas — Resumo geral", dataInicio, dataFim)}
        ${htmlTotais(data, freteEnabled)}`,
      );
      break;
    case "representantes":
      abrirImpressaoPdf(
        "Relatório de Vendas — Por representante",
        `${cabecalhoSecao("Por representante", dataInicio, dataFim)}
        ${htmlRepresentantes(opts.resumoRepresentantes)}`,
      );
      break;
    case "clientes":
      abrirImpressaoPdf(
        "Relatório de Vendas — Por cliente",
        `${cabecalhoSecao("Por cliente", dataInicio, dataFim)}
        ${htmlClientes(opts.resumoClientes)}`,
      );
      break;
    case "produtos":
      abrirImpressaoPdf(
        "Relatório de Vendas — Por produto",
        `${cabecalhoSecao("Por produto", dataInicio, dataFim)}
        ${htmlProdutos(opts.resumoProdutos)}`,
      );
      break;
    case "detalhes":
      abrirImpressaoPdf(
        "Relatório de Vendas — Detalhamento",
        `${cabecalhoSecao("Detalhamento das vendas", dataInicio, dataFim)}
        ${htmlDetalhes(data, freteEnabled)}`,
      );
      break;
  }
}

/** @deprecated Use exportarRelatorioVendasPdfSecao("detalhes", ...) */
export function exportarRelatorioVendasPdf(
  data: RelVendas,
  dataInicio: string,
  dataFim: string,
) {
  exportarRelatorioVendasPdfSecao("detalhes", {
    data,
    dataInicio,
    dataFim,
    resumoRepresentantes: [],
    resumoClientes: [],
    resumoProdutos: [],
  });
}

export function exportarRelatorioVendasExcel(data: RelVendas, dataInicio: string, dataFim: string) {
  const detalhes = data.vendas.map((v) => ({
    Ordem: vendaNumeroPublico(v),
    Data: formatDate(v.dataVenda),
    Cliente: v.cliente.nomeFantasia || v.cliente.razaoSocial,
    Vendedor: v.vendedor.nome,
    "Valor Total": parseFloat(String(v.valorTotal)),
    Frete: parseFloat(String(v.frete)),
    "Frete pago": formatFreteReciboLinha(v),
  }));
  const aggV: Record<number, { nome: string; total: number; quantidade: number }> = {};
  const aggC: Record<number, { nome: string; total: number; quantidade: number }> = {};
  data.vendas.forEach((v) => {
    if (!aggV[v.vendedorId]) aggV[v.vendedorId] = { nome: v.vendedor.nome, total: 0, quantidade: 0 };
    aggV[v.vendedorId].total += parseFloat(String(v.valorTotal));
    aggV[v.vendedorId].quantidade++;
    if (!aggC[v.clienteId]) {
      aggC[v.clienteId] = {
        nome: v.cliente.nomeFantasia || v.cliente.razaoSocial,
        total: 0,
        quantidade: 0,
      };
    }
    aggC[v.clienteId].total += parseFloat(String(v.valorTotal));
    aggC[v.clienteId].quantidade++;
  });
  const porV = Object.values(aggV).sort((a, b) => b.total - a.total).map((x) => ({ vendedor: x.nome, vendas: x.quantidade, total: x.total }));
  const porC = Object.values(aggC).sort((a, b) => b.total - a.total).map((x) => ({ cliente: x.nome, pedidos: x.quantidade, total: x.total }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhes), "Vendas");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porV), "Por vendedor");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porC), "Por cliente");
  XLSX.writeFile(wb, `relatorio-vendas-${dataInicio}-${dataFim}.xlsx`);
}
