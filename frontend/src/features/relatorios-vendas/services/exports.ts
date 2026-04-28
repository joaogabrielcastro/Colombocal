"use client";

import * as XLSX from "xlsx";
import { formatDate, formatFreteReciboLinha, formatMoney } from "@/lib/utils";
import type { RelVendas } from "../types";

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
    id: v.id,
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

export function exportarRelatorioVendasPdf(data: RelVendas, dataInicio: string, dataFim: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  const rows = data.vendas
    .map(
      (v) => `
      <tr>
        <td>#${v.id}</td>
        <td>${formatDate(v.dataVenda)}</td>
        <td>${(v.cliente.nomeFantasia || v.cliente.razaoSocial).replace(/</g, "&lt;")}</td>
        <td>${v.vendedor.nome}</td>
        <td>${formatMoney(v.valorTotal)}</td>
        <td>${formatMoney(v.frete)}</td>
        <td>${formatFreteReciboLinha(v).replace(/</g, "&lt;")}</td>
      </tr>`,
    )
    .join("");
  w.document.write(`
      <!DOCTYPE html><html><head><title>Relatório de Vendas</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
        h1 { font-size: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
        th { background: #f3f4f6; }
      </style></head><body>
      <h1>Relatório de Vendas</h1>
      <p style="color:#6b7280;font-size:12px">Período: ${dataInicio} a ${dataFim} · Gerado em ${new Date().toLocaleString("pt-BR")}</p>
      <table><thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Total</th><th>Frete</th><th>Frete pago</th></tr></thead>
      <tbody>${rows}</tbody></table>
      </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
