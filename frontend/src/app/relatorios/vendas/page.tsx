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
  formatQuantidade,
  type Venda,
} from "@/lib/utils";
import api from "@/lib/api";

interface RelVendas {
  vendas: Venda[];
  totalFaturamento: number;
  totalQuantidade: number;
  quantidade: number;
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
    const header = "Data,Cliente,Vendedor,Valor Total\n";
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

  const buscar = (ini?: string, fim?: string) => {
    const params = new URLSearchParams();
    if (ini ?? dataInicio) params.set("dataInicio", ini ?? dataInicio);
    if (fim ?? dataFim) params.set("dataFim", fim ?? dataFim);
    setLoading(true);
    api
      .get<RelVendas>(`/relatorios/vendas?${params}`)
      .then(setData)
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
              <button
                onClick={exportarCSV}
                className="btn-secondary flex items-center gap-1"
              >
                <ArrowDownTrayIcon className="w-4 h-4" /> Exportar CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center text-gray-400 py-8">Carregando...</div>
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
