"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import {
  formatMoney,
  formatDate,
  formatFreteReciboLinha,
  type Venda,
} from "@/lib/utils";
import api, { apiFetchWithMeta } from "@/lib/api";
import { TableListSkeleton } from "@/components/ui/skeletons";
import * as XLSX from "xlsx";

interface RelVendas {
  vendas: Venda[];
  totalFaturamento: number;
  totalQuantidade: number;
  quantidade: number;
  totalRegistros?: number;
}

export default function RelatorioVendasPage() {
  const [data, setData] = useState<RelVendas | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // Default: mês corrente
  useEffect(() => {
    const hoje = new Date();
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const fim = hoje.toISOString().split("T")[0];
    setDataInicio(ini);
    setDataFim(fim);
    buscar(ini, fim);
  }, []);

  const exportarCSV = () => {
    if (!data) return;
    const header =
      "Data,Cliente,Vendedor,Valor Total,Frete,Recibo frete\n";
    const rows = data.vendas
      .map((v) =>
        [
          formatDate(v.dataVenda),
          (v.cliente.nomeFantasia || v.cliente.razaoSocial).replace(
            /[,;"]/g,
            " ",
          ),
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
  };

  const exportarExcel = () => {
    if (!data) return;
    const detalhes = data.vendas.map((v) => ({
      id: v.id,
      data: formatDate(v.dataVenda),
      cliente: v.cliente.nomeFantasia || v.cliente.razaoSocial,
      vendedor: v.vendedor.nome,
      valorTotal: parseFloat(String(v.valorTotal)),
      frete: parseFloat(String(v.frete)),
      reciboFrete: formatFreteReciboLinha(v),
    }));
    const aggV: Record<number, { nome: string; total: number; quantidade: number }> =
      {};
    const aggC: Record<number, { nome: string; total: number; quantidade: number }> =
      {};
    data.vendas.forEach((v) => {
      if (!aggV[v.vendedorId])
        aggV[v.vendedorId] = {
          nome: v.vendedor.nome,
          total: 0,
          quantidade: 0,
        };
      aggV[v.vendedorId].total += parseFloat(String(v.valorTotal));
      aggV[v.vendedorId].quantidade++;
      if (!aggC[v.clienteId])
        aggC[v.clienteId] = {
          nome: v.cliente.nomeFantasia || v.cliente.razaoSocial,
          total: 0,
          quantidade: 0,
        };
      aggC[v.clienteId].total += parseFloat(String(v.valorTotal));
      aggC[v.clienteId].quantidade++;
    });
    const porV = Object.values(aggV)
      .sort((a, b) => b.total - a.total)
      .map((x) => ({ vendedor: x.nome, vendas: x.quantidade, total: x.total }));
    const porC = Object.values(aggC)
      .sort((a, b) => b.total - a.total)
      .map((x) => ({ cliente: x.nome, pedidos: x.quantidade, total: x.total }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(detalhes),
      "Vendas",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(porV),
      "Por vendedor",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(porC),
      "Por cliente",
    );
    XLSX.writeFile(wb, `relatorio-vendas-${dataInicio}-${dataFim}.xlsx`);
  };

  const exportarPdf = () => {
    if (!data) return;
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
      <table><thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Total</th><th>Frete</th><th>Recibo</th></tr></thead>
      <tbody>${rows}</tbody></table>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const buscar = (ini?: string, fim?: string) => {
    const params = new URLSearchParams();
    if (ini ?? dataInicio) params.set("dataInicio", ini ?? dataInicio);
    if (fim ?? dataFim) params.set("dataFim", fim ?? dataFim);
    params.set("take", "500");
    params.set("skip", "0");
    setLoading(true);
    apiFetchWithMeta<RelVendas>(`/relatorios/vendas?${params}`)
      .then(({ data: body, meta }) =>
        setData({
          ...body,
          totalRegistros: meta.totalCount ?? body.totalRegistros,
        }),
      )
      .finally(() => setLoading(false));
  };

  // Agrupar por cliente
  const porCliente: Record<
    number,
    { nome: string; total: number; quantidade: number }
  > = {};
  const porVendedor: Record<
    number,
    { nome: string; total: number; quantidade: number }
  > = {};
  const porProduto: Record<
    number,
    { nome: string; quantidade: number; total: number; unidade: string }
  > = {};

  data?.vendas.forEach((v) => {
    // Por cliente
    if (!porCliente[v.clienteId])
      porCliente[v.clienteId] = {
        nome: v.cliente.nomeFantasia || v.cliente.razaoSocial,
        total: 0,
        quantidade: 0,
      };
    porCliente[v.clienteId].total += parseFloat(String(v.valorTotal));
    porCliente[v.clienteId].quantidade++;
    // Por vendedor
    if (!porVendedor[v.vendedorId])
      porVendedor[v.vendedorId] = {
        nome: v.vendedor.nome,
        total: 0,
        quantidade: 0,
      };
    porVendedor[v.vendedorId].total += parseFloat(String(v.valorTotal));
    porVendedor[v.vendedorId].quantidade++;
    // Por produto
    v.itens?.forEach((item) => {
      if (!porProduto[item.produtoId])
        porProduto[item.produtoId] = {
          nome: item.produto.nome,
          quantidade: 0,
          total: 0,
          unidade: item.produto.unidade,
        };
      porProduto[item.produtoId].quantidade += parseFloat(
        String(item.quantidade),
      );
      porProduto[item.produtoId].total += parseFloat(String(item.subtotal));
    });
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Relatório de Vendas
        </h1>
        {data?.totalRegistros != null && data.totalRegistros > data.vendas.length && (
          <p className="text-sm text-amber-700 mt-1">
            Exibindo {data.vendas.length} de {data.totalRegistros} vendas no período (limite 500 por consulta). Ajuste datas ou exporte em lotes.
          </p>
        )}
      </div>

      <div className="card p-4 mb-6">
        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex items-end">
            <button onClick={() => buscar()} className="btn-primary">
              <MagnifyingGlassIcon className="w-4 h-4" /> Gerar
            </button>
            {data && (
              <>
                <button
                  onClick={exportarCSV}
                  className="btn-secondary flex items-center gap-1"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" /> CSV
                </button>
                <button
                  onClick={exportarExcel}
                  className="btn-secondary flex items-center gap-1"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" /> Excel
                </button>
                <button
                  onClick={exportarPdf}
                  className="btn-secondary flex items-center gap-1"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" /> PDF
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="card p-4">
          <TableListSkeleton rows={10} cols={6} />
        </div>
      )}

      {data && !loading && (
        <>
          {/* Totais */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Vendas no período</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {data.quantidade}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Faturamento total</p>
              <p className="text-3xl font-bold text-green-700 mt-1">
                {formatMoney(data.totalFaturamento)}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Ticket médio</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {data.quantidade > 0
                  ? formatMoney(data.totalFaturamento / data.quantidade)
                  : "-"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Por cliente */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold">Por Cliente</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header">Cliente</th>
                    <th className="table-header text-right">Qtd</th>
                    <th className="table-header text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(porCliente)
                    .sort((a, b) => b.total - a.total)
                    .map((c, i) => (
                      <tr key={i} className="table-row">
                        <td className="table-cell font-medium">{c.nome}</td>
                        <td className="table-cell text-right text-gray-500">
                          {c.quantidade}
                        </td>
                        <td className="table-cell text-right font-semibold">
                          {formatMoney(c.total)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Por produto */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold">Por Produto</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header">Produto</th>
                    <th className="table-header text-right">Quantidade</th>
                    <th className="table-header text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(porProduto)
                    .sort((a, b) => b.total - a.total)
                    .map((p, i) => (
                      <tr key={i} className="table-row">
                        <td className="table-cell font-medium">{p.nome}</td>
                        <td className="table-cell text-right text-gray-500">
                          {p.quantidade.toLocaleString("pt-BR")} {p.unidade}
                        </td>
                        <td className="table-cell text-right font-semibold">
                          {formatMoney(p.total)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detalhes */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold">Detalhamento das Vendas</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="table-header">#</th>
                    <th className="table-header">Data</th>
                    <th className="table-header">Cliente</th>
                    <th className="table-header">Vendedor</th>
                    <th className="table-header text-right">Frete</th>
                    <th className="table-header">Recibo frete</th>
                    <th className="table-header text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vendas.map((v) => (
                    <tr key={v.id} className="table-row">
                      <td className="table-cell text-gray-400">#{v.id}</td>
                      <td className="table-cell">{formatDate(v.dataVenda)}</td>
                      <td className="table-cell font-medium">
                        {v.cliente.nomeFantasia || v.cliente.razaoSocial}
                      </td>
                      <td className="table-cell">{v.vendedor.nome}</td>
                      <td className="table-cell text-right">
                        {formatMoney(v.frete)}
                      </td>
                      <td className="table-cell text-xs text-gray-600 max-w-[11rem]">
                        {formatFreteReciboLinha(v)}
                      </td>
                      <td className="table-cell text-right font-semibold">
                        {formatMoney(v.valorTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
