"use client";

import * as XLSX from "xlsx";
import {
  formatDate,
  formatFreteReciboLinha,
  formatMoney,
  vendaNumeroPublico,
} from "@/lib/utils";
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
  .hint { margin-top: 16px; font-size: 10px; color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
  th { background: #f3f4f6; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .kpi label { display: block; font-size: 11px; color: #6b7280; }
  .kpi strong { font-size: 18px; }
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
};

export function exportarRelatorioVendasPdfSecao(
  secao: RelatorioVendasPdfSecao,
  opts: ExportarPdfSecaoOpts,
) {
  const { data, dataInicio, dataFim } = opts;
  const totalRegistros = data.totalRegistros ?? data.quantidade;

  switch (secao) {
    case "totais": {
      const ticket =
        totalRegistros > 0 ? data.totalFaturamento / totalRegistros : 0;
      abrirImpressaoPdf(
        `Relatório de Vendas — Resumo geral`,
        `${cabecalhoSecao("Relatório de Vendas — Resumo geral", dataInicio, dataFim)}
        <div class="kpis">
          <div class="kpi"><label>Vendas no período</label><strong>${totalRegistros}</strong></div>
          <div class="kpi"><label>Total vendido</label><strong>${escapeHtml(formatMoney(data.totalFaturamento))}</strong></div>
          <div class="kpi"><label>Frete total</label><strong>${escapeHtml(formatMoney(data.totalFrete ?? 0))}</strong></div>
          <div class="kpi"><label>Ticket médio</label><strong>${totalRegistros > 0 ? escapeHtml(formatMoney(ticket)) : "—"}</strong></div>
        </div>`,
      );
      break;
    }
    case "representantes": {
      const rows = opts.resumoRepresentantes
        .map(
          (r) => `<tr>
          <td>${escapeHtml(r.nome)}</td>
          <td class="num">${r.quantidade}</td>
          <td class="num">${r.participacao.toFixed(2)}%</td>
          <td class="num">${escapeHtml(formatMoney(r.total))}</td>
        </tr>`,
        )
        .join("");
      abrirImpressaoPdf(
        `Relatório de Vendas — Por representante`,
        `${cabecalhoSecao("Por representante", dataInicio, dataFim)}
        <table>
          <thead><tr>
            <th>Representante</th><th class="num">Qtd</th><th class="num">Part. %</th><th class="num">Total</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#666">Sem dados no período.</td></tr>`}</tbody>
        </table>`,
      );
      break;
    }
    case "clientes": {
      const rows = opts.resumoClientes
        .map(
          (c) => `<tr>
          <td>${escapeHtml(c.nome)}</td>
          <td class="num">${c.quantidade}</td>
          <td class="num">${escapeHtml(formatMoney(c.total))}</td>
        </tr>`,
        )
        .join("");
      abrirImpressaoPdf(
        `Relatório de Vendas — Por cliente`,
        `${cabecalhoSecao("Por cliente", dataInicio, dataFim)}
        <table>
          <thead><tr><th>Cliente</th><th class="num">Qtd</th><th class="num">Total</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="3" style="text-align:center;color:#666">Sem dados no período.</td></tr>`}</tbody>
        </table>`,
      );
      break;
    }
    case "produtos": {
      const rows = opts.resumoProdutos
        .map(
          (p) => `<tr>
          <td>${escapeHtml(p.nome)}</td>
          <td class="num">${escapeHtml(p.quantidade.toLocaleString("pt-BR"))} ${escapeHtml(p.unidade)}</td>
          <td class="num">${escapeHtml(formatMoney(p.total))}</td>
        </tr>`,
        )
        .join("");
      abrirImpressaoPdf(
        `Relatório de Vendas — Por produto`,
        `${cabecalhoSecao("Por produto", dataInicio, dataFim)}
        <table>
          <thead><tr><th>Produto</th><th class="num">Quantidade</th><th class="num">Total</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="3" style="text-align:center;color:#666">Sem dados no período.</td></tr>`}</tbody>
        </table>`,
      );
      break;
    }
    case "detalhes": {
      const rows = data.vendas
        .map(
          (v) => `<tr>
          <td>#${vendaNumeroPublico(v)}</td>
          <td>${escapeHtml(formatDate(v.dataVenda))}</td>
          <td>${escapeHtml(v.cliente.nomeFantasia || v.cliente.razaoSocial)}</td>
          <td>${escapeHtml(v.vendedor.nome)}</td>
          <td class="num">${escapeHtml(formatMoney(v.valorTotal))}</td>
          <td class="num">${escapeHtml(formatMoney(v.frete))}</td>
          <td>${escapeHtml(formatFreteReciboLinha(v))}</td>
        </tr>`,
        )
        .join("");
      abrirImpressaoPdf(
        `Relatório de Vendas — Detalhamento`,
        `${cabecalhoSecao("Detalhamento das vendas", dataInicio, dataFim)}
        <table>
          <thead><tr>
            <th>#</th><th>Data</th><th>Cliente</th><th>Vendedor</th>
            <th class="num">Total</th><th class="num">Frete</th><th>Frete pago</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="7" style="text-align:center;color:#666">Sem vendas no período.</td></tr>`}</tbody>
        </table>`,
      );
      break;
    }
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

export function exportarRelatorioVendasCSV(data: RelVendas, dataInicio: string, dataFim: string) {
  const header = "Data,Cliente,Vendedor,Valor Total,Frete,Frete pago\n";
  const rows = data.vendas
    .map((v) =>
      [
        formatDate(v.dataVenda),
        (v.cliente.nomeFantasia || v.cliente.razaoSocial).replace(/[,;"]/g, " "),
        v.vendedor.nome.replace(/[,;"]/g, " "),
        parseFloat(String(v.valorTotal)).toFixed(2),
        parseFloat(String(v.frete)).toFixed(2),
        formatFreteReciboLinha(v).replace(/[,;"]/g, " "),
      ].join(","),
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + header + rows], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-vendas-${dataInicio}-${dataFim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarRelatorioVendasExcel(data: RelVendas, dataInicio: string, dataFim: string) {
  const detalhes = data.vendas.map((v) => ({
    numero: vendaNumeroPublico(v),
    data: formatDate(v.dataVenda),
    cliente: v.cliente.nomeFantasia || v.cliente.razaoSocial,
    vendedor: v.vendedor.nome,
    valorTotal: parseFloat(String(v.valorTotal)),
    frete: parseFloat(String(v.frete)),
    reciboFrete: formatFreteReciboLinha(v),
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
