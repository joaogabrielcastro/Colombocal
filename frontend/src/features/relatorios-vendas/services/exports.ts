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
import {
  isRepresentanteSemComissao,
  montarResumoRelatorioVendas,
  resumoComissaoVisual,
  type ResumoCliente,
  type ResumoClienteProduto,
  type ResumoProduto,
  type ResumoRepresentante,
} from "./resumo";
import { formatVendaProdutos, formatVendaQuantidades, textoObservacao } from "./detalheVenda";

export type RelatorioVendasPdfSecao =
  | "totais"
  | "representantes"
  | "clientes"
  | "produtos"
  | "clienteProdutos"
  | "detalhes";

export const RELATORIO_VENDAS_PDF_SECOES: {
  id: RelatorioVendasPdfSecao;
  label: string;
}[] = [
  { id: "totais", label: "Resumo geral (totais)" },
  { id: "representantes", label: "Por representante" },
  { id: "clientes", label: "Por cliente" },
  { id: "produtos", label: "Por produto" },
  { id: "clienteProdutos", label: "Produtos por cliente" },
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
  .meta { color: #6b7280; font-size: 12px; margin-bottom: 8px; }
  .hint { margin-top: 16px; font-size: 10px; color: #666; }
  .secao { page-break-inside: auto; break-inside: auto; }
  .secao-compacta { page-break-inside: avoid; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; page-break-inside: auto; table-layout: fixed; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  th, td { border: 1px solid #e5e7eb; padding: 7px 8px; font-size: 11px; text-align: left; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
  th { background: #f3f4f6; font-weight: 700; }
  td.num, th.num { text-align: right; white-space: nowrap; overflow-wrap: normal; word-break: keep-all; }
  td.ordem, th.ordem { font-weight: 700; color: #1d4ed8; font-family: ui-monospace, monospace; white-space: nowrap; width: 4.5rem; }
  .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .kpi label { display: block; font-size: 11px; color: #6b7280; }
  .kpi strong { font-size: 16px; }
  .alerta { border: 1px solid #fed7aa; background: #fff7ed; border-radius: 8px; padding: 12px; margin-top: 12px; }
  .alerta label { display: block; font-size: 11px; color: #9a3412; font-weight: 700; }
  tr.destaque-sem td { background: #fff7ed; }
  @media print {
    body { padding: 12px; }
    h2 { page-break-before: auto; }
    .secao-detalhes { page-break-before: always; }
    .meta + .secao-detalhes { page-break-before: auto; }
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

function cabecalhoSecao(
  titulo: string,
  dataInicio: string,
  dataFim: string,
  filtrosTexto?: string,
) {
  const filtros = filtrosTexto
    ? `<p class="meta">Filtros aplicados: ${escapeHtml(filtrosTexto)}</p>`
    : "";
  return `<h1>${escapeHtml(titulo)}</h1>
  <p class="meta">Período: ${escapeHtml(periodoLabel(dataInicio, dataFim))} · Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</p>
  ${filtros}`;
}

export type ExportarPdfSecaoOpts = {
  data: RelVendas;
  dataInicio: string;
  dataFim: string;
  resumoRepresentantes: ResumoRepresentante[];
  resumoClientes: ResumoCliente[];
  resumoProdutos: ResumoProduto[];
  resumoClienteProdutos?: ResumoClienteProduto[];
  freteEnabled?: boolean;
  filtrosTexto?: string;
};

function htmlTotais(data: RelVendas, reps: ResumoRepresentante[], freteEnabled: boolean) {
  const totalRegistros = data.totalRegistros ?? data.quantidade;
  const ticket = totalRegistros > 0 ? data.totalFaturamento / totalRegistros : 0;
  const freteKpi = freteEnabled
    ? `<div class="kpi"><label>Frete total</label><strong>${escapeHtml(formatMoney(data.totalFrete ?? 0))}</strong></div>`
    : "";
  const comissao = resumoComissaoVisual(reps, data.totalFaturamento);
  const extraKpis = comissao.temSemComissao
    ? `<div class="kpi"><label>Vendas com comissão</label><strong>${escapeHtml(formatMoney(comissao.totalCom))}</strong></div>
       <div class="kpi"><label>Vendas sem comissão</label><strong>${escapeHtml(formatMoney(comissao.totalSem))}</strong></div>`
    : "";
  const alerta = comissao.temSemComissao
    ? `<div class="alerta"><label>Vendas sem comissão</label><strong>${escapeHtml(formatMoney(comissao.totalSem))}</strong>
        <span> · ${comissao.participacaoSem.toFixed(2).replace(".", ",")}% das vendas</span></div>`
    : "";
  return `<div class="secao secao-compacta">
    <h2>Indicadores</h2>
    <div class="kpis">
      <div class="kpi"><label>Vendas no período</label><strong>${totalRegistros}</strong></div>
      <div class="kpi"><label>Total vendido</label><strong>${escapeHtml(formatMoney(data.totalFaturamento))}</strong></div>
      ${freteKpi}
      <div class="kpi"><label>Ticket médio</label><strong>${totalRegistros > 0 ? escapeHtml(formatMoney(ticket)) : "—"}</strong></div>
      ${extraKpis}
    </div>
    ${alerta}
  </div>`;
}

function htmlResumoExecutivo(data: RelVendas, reps: ResumoRepresentante[]) {
  const totalRegistros = data.totalRegistros ?? data.quantidade;
  const ticket = totalRegistros > 0 ? data.totalFaturamento / totalRegistros : 0;
  const comissao = resumoComissaoVisual(reps, data.totalFaturamento);
  const semTxt = comissao.temSemComissao
    ? ` Vendas sem comissão: ${formatMoney(comissao.totalSem)} (${comissao.participacaoSem.toFixed(2).replace(".", ",")}%).`
    : "";
  return `<div class="secao secao-compacta">
    <h2>Resumo executivo</h2>
    <p class="meta">${totalRegistros} venda(s) · Total ${escapeHtml(formatMoney(data.totalFaturamento))} · Ticket médio ${
      totalRegistros > 0 ? escapeHtml(formatMoney(ticket)) : "—"
    }.${escapeHtml(semTxt)}</p>
  </div>`;
}

function htmlRepresentantes(reps: ResumoRepresentante[]) {
  const rows = reps
    .map((r) => {
      const cls = isRepresentanteSemComissao(r.nome) ? " class=\"destaque-sem\"" : "";
      return `<tr${cls}>
        <td>${escapeHtml(r.nome)}</td>
        <td class="num">${r.quantidade}</td>
        <td class="num">${r.participacao.toFixed(2)}%</td>
        <td class="num">${escapeHtml(formatMoney(r.total))}</td>
      </tr>`;
    })
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
        <td class="num">${(c.participacao ?? 0).toFixed(2)}%</td>
        <td class="num">${escapeHtml(formatMoney(c.total))}</td>
      </tr>`,
    )
    .join("");
  return `<div class="secao">
    <h2>Por cliente</h2>
    <table>
      <thead><tr><th>Cliente</th><th class="num">Qtd</th><th class="num">Part. %</th><th class="num">Total</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#666">Sem dados no período.</td></tr>`}</tbody>
    </table>
  </div>`;
}

function htmlClienteProdutos(grupos: ResumoClienteProduto[]) {
  const rows = grupos
    .flatMap((c) =>
      c.produtos.map(
        (p, pi) => `<tr>
        <td>${pi === 0 ? escapeHtml(c.nome) : ""}</td>
        <td>${escapeHtml(p.produtoNome)}</td>
        <td class="num">${escapeHtml(p.quantidade.toLocaleString("pt-BR"))} ${escapeHtml(p.unidade)}</td>
        <td class="num">${escapeHtml(formatMoney(p.total))}</td>
      </tr>`,
      ),
    )
    .join("");
  return `<div class="secao">
    <h2>Produtos por cliente</h2>
    <p class="meta">Quanto cada cliente levou de cada produto no período.</p>
    <table>
      <thead><tr>
        <th>Cliente</th><th>Produto</th><th class="num">Quantidade</th><th class="num">Total</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#666">Sem dados no período.</td></tr>`}</tbody>
    </table>
  </div>`;
}

function htmlProdutos(produtos: ResumoProduto[]) {
  const rows = produtos
    .map(
      (p) => `<tr>
        <td>${escapeHtml(p.nome)}</td>
        <td class="num">${escapeHtml(p.quantidade.toLocaleString("pt-BR"))} ${escapeHtml(p.unidade)}</td>
        <td class="num">${(p.participacao ?? 0).toFixed(2)}%</td>
        <td class="num">${escapeHtml(formatMoney(p.total))}</td>
      </tr>`,
    )
    .join("");
  return `<div class="secao">
    <h2>Por produto</h2>
    <table>
      <thead><tr><th>Produto</th><th class="num">Quantidade</th><th class="num">Part. %</th><th class="num">Total</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#666">Sem dados no período.</td></tr>`}</tbody>
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
        <td>${escapeHtml(formatDate(v.dataVenda))}</td>
        <td class="ordem">#${vendaNumeroPublico(v)}</td>
        <td>${escapeHtml(v.cliente.nomeFantasia || v.cliente.razaoSocial)}</td>
        <td>${escapeHtml(formatVendaProdutos(v))}</td>
        <td>${escapeHtml(v.vendedor.nome)}</td>
        <td>${escapeHtml(v.motorista?.nome || "—")}</td>
        <td class="num">${escapeHtml(formatVendaQuantidades(v))}</td>
        ${freteCols}
        <td class="num">${escapeHtml(formatMoney(v.valorTotal))}</td>
        <td>${escapeHtml(textoObservacao(v))}</td>
      </tr>`;
    })
    .join("");
  const colspan = freteEnabled ? 11 : 9;
  return `<div class="secao secao-detalhes">
    <h2>Detalhamento das vendas</h2>
    <p class="meta">${data.vendas.length} registro(s) no detalhamento.</p>
    <table>
      <thead><tr>
        <th>Data</th><th class="ordem">Nº</th><th>Cliente</th><th>Produto</th><th>Representante</th><th>Motorista</th>
        <th class="num">Quantidade</th>
        ${freteHead}
        <th class="num">Total</th><th>Observação</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="${colspan}" style="text-align:center;color:#666">Sem vendas no período.</td></tr>`}</tbody>
    </table>
  </div>`;
}

function corpoCompleto(opts: ExportarPdfSecaoOpts) {
  const { data, dataInicio, dataFim } = opts;
  const freteEnabled = opts.freteEnabled !== false;
  return `${cabecalhoSecao("Relatório de Vendas — Completo", dataInicio, dataFim, opts.filtrosTexto)}
    ${htmlTotais(data, opts.resumoRepresentantes, freteEnabled)}
    ${htmlResumoExecutivo(data, opts.resumoRepresentantes)}
    ${htmlRepresentantes(opts.resumoRepresentantes)}
    ${htmlClientes(opts.resumoClientes)}
    ${htmlProdutos(opts.resumoProdutos)}
    ${htmlClienteProdutos(opts.resumoClienteProdutos ?? [])}
    ${htmlDetalhes(data, freteEnabled)}`;
}

/** PDF com todas as seções — ideal para enviar ao cliente. */
export function exportarRelatorioVendasPdfCompleto(opts: ExportarPdfSecaoOpts) {
  abrirImpressaoPdf("Relatório de Vendas — Completo", corpoCompleto(opts));
}

export function exportarRelatorioVendasPdfSecao(
  secao: RelatorioVendasPdfSecao,
  opts: ExportarPdfSecaoOpts,
) {
  const { data, dataInicio, dataFim } = opts;
  const freteEnabled = opts.freteEnabled !== false;
  const head = (titulo: string) => cabecalhoSecao(titulo, dataInicio, dataFim, opts.filtrosTexto);

  switch (secao) {
    case "totais":
      abrirImpressaoPdf(
        "Relatório de Vendas — Resumo geral",
        `${head("Relatório de Vendas — Resumo geral")}
        ${htmlTotais(data, opts.resumoRepresentantes, freteEnabled)}
        ${htmlResumoExecutivo(data, opts.resumoRepresentantes)}`,
      );
      break;
    case "representantes":
      abrirImpressaoPdf(
        "Relatório de Vendas — Por representante",
        `${head("Por representante")}
        ${htmlRepresentantes(opts.resumoRepresentantes)}`,
      );
      break;
    case "clientes":
      abrirImpressaoPdf(
        "Relatório de Vendas — Por cliente",
        `${head("Por cliente")}
        ${htmlClientes(opts.resumoClientes)}`,
      );
      break;
    case "produtos":
      abrirImpressaoPdf(
        "Relatório de Vendas — Por produto",
        `${head("Por produto")}
        ${htmlProdutos(opts.resumoProdutos)}`,
      );
      break;
    case "clienteProdutos":
      abrirImpressaoPdf(
        "Relatório de Vendas — Produtos por cliente",
        `${head("Produtos por cliente")}
        ${htmlClienteProdutos(opts.resumoClienteProdutos ?? [])}`,
      );
      break;
    case "detalhes":
      abrirImpressaoPdf(
        "Relatório de Vendas — Detalhamento",
        `${head("Detalhamento das vendas")}
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
    resumoClienteProdutos: [],
  });
}

export function exportarRelatorioVendasExcel(data: RelVendas, dataInicio: string, dataFim: string) {
  const {
    resumoRepresentantes,
    resumoClientes,
    resumoProdutos,
    resumoClienteProdutos,
  } = montarResumoRelatorioVendas(data);
  const totalRegistros = data.totalRegistros ?? data.quantidade;
  const ticket = totalRegistros > 0 ? data.totalFaturamento / totalRegistros : 0;
  const comissao = resumoComissaoVisual(resumoRepresentantes, data.totalFaturamento);

  const resumoGeral = [
    { Indicador: "Vendas no período", Valor: totalRegistros },
    { Indicador: "Total vendido", Valor: data.totalFaturamento },
    { Indicador: "Frete total", Valor: data.totalFrete ?? 0 },
    { Indicador: "Ticket médio", Valor: ticket },
    ...(comissao.temSemComissao
      ? [
          { Indicador: "Vendas com comissão", Valor: comissao.totalCom },
          { Indicador: "Vendas sem comissão", Valor: comissao.totalSem },
        ]
      : []),
  ];

  const detalhes = data.vendas.map((v) => ({
    Data: formatDate(v.dataVenda),
    Ordem: vendaNumeroPublico(v),
    Cliente: v.cliente.nomeFantasia || v.cliente.razaoSocial,
    Produto: formatVendaProdutos(v),
    Representante: v.vendedor.nome,
    Motorista: v.motorista?.nome || "",
    Quantidade: formatVendaQuantidades(v),
    "Valor Total": parseFloat(String(v.valorTotal)),
    Frete: parseFloat(String(v.frete)),
    "Frete pago": formatFreteReciboLinha(v),
    Observação: v.observacoes || "",
  }));

  const porV = resumoRepresentantes.map((x) => ({
    vendedor: x.nome,
    vendas: x.quantidade,
    participacao: Number(x.participacao.toFixed(2)),
    total: x.total,
  }));
  const porC = resumoClientes.map((x) => ({
    cliente: x.nome,
    pedidos: x.quantidade,
    participacao: Number((x.participacao ?? 0).toFixed(2)),
    total: x.total,
  }));
  const porP = resumoProdutos.map((x) => ({
    produto: x.nome,
    quantidade: x.quantidade,
    unidade: x.unidade,
    participacao: Number((x.participacao ?? 0).toFixed(2)),
    total: x.total,
  }));
  const porClienteProduto = resumoClienteProdutos.flatMap((c) =>
    c.produtos.map((p) => ({
      Cliente: c.nome,
      Produto: p.produtoNome,
      Quantidade: p.quantidade,
      Unidade: p.unidade,
      Total: p.total,
    })),
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoGeral), "Resumo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhes), "Vendas");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porV), "Por vendedor");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porC), "Por cliente");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porP), "Por produto");
  if (porClienteProduto.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(porClienteProduto),
      "Produtos por cliente",
    );
  }
  XLSX.writeFile(wb, `relatorio-vendas-${dataInicio}-${dataFim}.xlsx`);
}
