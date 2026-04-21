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
  type Cliente,
  type Produto,
  type Venda,
  type Vendedor,
} from "@/lib/utils";
import api, { apiFetchWithMeta } from "@/lib/api";
import { TableListSkeleton } from "@/components/ui/skeletons";
import * as XLSX from "xlsx";

interface RelVendas {
  vendas: Venda[];
  totalFaturamento: number;
  totalFrete?: number;
  totalQuantidade: number;
  quantidade: number;
  totalRegistros?: number;
  resumoRepresentantes?: Array<{
    vendedorId: number;
    vendedorNome: string;
    comissaoPercentual: number;
    faturamento: number;
    frete: number;
    quantidadeVendas: number;
    ticketMedio: number;
    participacao: number;
  }>;
  resumoClientes?: Array<{
    clienteId: number;
    clienteNome: string;
    faturamento: number;
    quantidadeVendas: number;
    ticketMedio: number;
  }>;
  resumoProdutos?: Array<{
    produtoId: number;
    produtoNome: string;
    unidade: string;
    quantidade: number;
    faturamento: number;
    quantidadeItens: number;
  }>;
}

type SortRepKey = "nome" | "quantidade" | "participacao" | "total";

export default function RelatorioVendasPage() {
  const [data, setData] = useState<RelVendas | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [busca, setBusca] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [repSort, setRepSort] = useState<{
    key: SortRepKey;
    dir: "asc" | "desc";
  }>({
    key: "total",
    dir: "desc",
  });

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
    void Promise.all([
      api.get<Vendedor[]>("/vendedores?take=500"),
      api.get<{ clientes: Cliente[] }>("/clientes?ativo=true&take=500"),
      api.get<Produto[]>("/produtos?ativo=true&take=500"),
    ]).then(([vendedoresResp, clientesResp, produtosResp]) => {
      setVendedores(vendedoresResp);
      setClientes(clientesResp.clientes);
      setProdutos(produtosResp);
    });
  }, []);

  const exportarCSV = () => {
    if (!data) return;
    const header =
      "Data,Cliente,Vendedor,Valor Total,Frete,Frete pago\n";
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
      <table><thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Total</th><th>Frete</th><th>Frete pago</th></tr></thead>
      <tbody>${rows}</tbody></table>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const buscar = (
    ini?: string,
    fim?: string,
    override?: Partial<{
      busca: string;
      vendedorId: string;
      clienteId: string;
      produtoId: string;
    }>,
  ) => {
    const params = new URLSearchParams();
    if (ini ?? dataInicio) params.set("dataInicio", ini ?? dataInicio);
    if (fim ?? dataFim) params.set("dataFim", fim ?? dataFim);
    const buscaEff = (override?.busca ?? busca).trim();
    const vendedorEff = override?.vendedorId ?? vendedorId;
    const clienteEff = override?.clienteId ?? clienteId;
    const produtoEff = override?.produtoId ?? produtoId;
    if (buscaEff) params.set("busca", buscaEff);
    if (vendedorEff) params.set("vendedorId", vendedorEff);
    if (clienteEff) params.set("clienteId", clienteEff);
    if (produtoEff) params.set("produtoId", produtoEff);
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

  // Agregações (preferem o resumo completo retornado pela API)
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

  const resumoRepresentantes =
    data?.resumoRepresentantes?.map((r) => ({
      nome: r.vendedorNome,
      total: r.faturamento,
      frete: r.frete,
      quantidade: r.quantidadeVendas,
      ticketMedio: r.ticketMedio,
      participacao: r.participacao,
    })) ??
    Object.values(porVendedor)
      .sort((a, b) => b.total - a.total)
      .map((x) => ({
        nome: x.nome,
        total: x.total,
        frete: 0,
        quantidade: x.quantidade,
        ticketMedio: x.quantidade > 0 ? x.total / x.quantidade : 0,
        participacao: data && data.totalFaturamento > 0 ? (x.total / data.totalFaturamento) * 100 : 0,
      }));

  const resumoClientes =
    data?.resumoClientes?.map((r) => ({
      nome: r.clienteNome,
      total: r.faturamento,
      quantidade: r.quantidadeVendas,
    })) ??
    Object.values(porCliente).sort((a, b) => b.total - a.total);

  const resumoProdutos =
    data?.resumoProdutos?.map((r) => ({
      nome: r.produtoNome,
      quantidade: r.quantidade,
      total: r.faturamento,
      unidade: r.unidade || "",
    })) ??
    Object.values(porProduto).sort((a, b) => b.total - a.total);

  const resumoRepresentantesOrdenado = [...resumoRepresentantes].sort((a, b) => {
    const dir = repSort.dir === "asc" ? 1 : -1;
    if (repSort.key === "nome") {
      return a.nome.localeCompare(b.nome, "pt-BR") * dir;
    }
    if (repSort.key === "quantidade") {
      return (a.quantidade - b.quantidade) * dir;
    }
    if (repSort.key === "participacao") {
      return (a.participacao - b.participacao) * dir;
    }
    return (a.total - b.total) * dir;
  });

  const toggleRepSort = (key: SortRepKey) => {
    setRepSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "nome" ? "asc" : "desc" },
    );
  };

  const sortIndicator = (key: SortRepKey) =>
    repSort.key === key ? (repSort.dir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Relatório de Vendas
        </h1>
        <div className="mt-2">
          <Link href="/relatorios/comissoes" className="text-sm text-blue-600 hover:underline">
            Abrir relatório de comissões (com impressão) →
          </Link>
        </div>
        {data?.totalRegistros != null && data.totalRegistros > data.vendas.length && (
          <p className="text-sm text-amber-700 mt-1">
            Exibindo {data.vendas.length} de {data.totalRegistros} vendas no período (limite 500 por consulta). Ajuste datas ou exporte em lotes.
          </p>
        )}
      </div>

      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Representante</label>
            <select
              value={vendedorId}
              onChange={(e) => setVendedorId(e.target.value)}
              className="input-field"
            >
              <option value="">Todos</option>
              {vendedores.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  {v.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="input-field"
            >
              <option value="">Todos</option>
              {clientes.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nomeFantasia || c.razaoSocial}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Produto</label>
            <select
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
              className="input-field"
            >
              <option value="">Todos</option>
              {produtos.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Busca</label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente, representante ou observação"
              className="input-field"
            />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-end mt-3">
          <div className="flex items-end">
            <button onClick={() => buscar()} className="btn-primary">
              <MagnifyingGlassIcon className="w-4 h-4" /> Gerar
            </button>
            <button
              onClick={() => {
                setBusca("");
                setVendedorId("");
                setClienteId("");
                setProdutoId("");
                buscar(dataInicio, dataFim, {
                  busca: "",
                  vendedorId: "",
                  clienteId: "",
                  produtoId: "",
                });
              }}
              className="btn-secondary flex items-center gap-1"
            >
              Limpar
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Vendas no período</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {data.totalRegistros ?? data.quantidade}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Total vendido (período)</p>
              <p className="text-3xl font-bold text-green-700 mt-1">
                {formatMoney(data.totalFaturamento)}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Frete total</p>
              <p className="text-3xl font-bold text-indigo-700 mt-1">
                {formatMoney(data.totalFrete ?? 0)}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Ticket médio</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {(data.totalRegistros ?? data.quantidade) > 0
                  ? formatMoney(
                      data.totalFaturamento / (data.totalRegistros ?? data.quantidade),
                    )
                  : "-"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold">Por Representante (Completo)</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header">
                      <button
                        type="button"
                        onClick={() => toggleRepSort("nome")}
                        className="hover:underline"
                      >
                        Representante{sortIndicator("nome")}
                      </button>
                    </th>
                    <th className="table-header text-right">
                      <button
                        type="button"
                        onClick={() => toggleRepSort("quantidade")}
                        className="hover:underline"
                      >
                        Qtd{sortIndicator("quantidade")}
                      </button>
                    </th>
                    <th className="table-header text-right">
                      <button
                        type="button"
                        onClick={() => toggleRepSort("participacao")}
                        className="hover:underline"
                      >
                        Part. %{sortIndicator("participacao")}
                      </button>
                    </th>
                    <th className="table-header text-right">
                      <button
                        type="button"
                        onClick={() => toggleRepSort("total")}
                        className="hover:underline"
                      >
                        Total{sortIndicator("total")}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resumoRepresentantesOrdenado.map((r, i) => (
                    <tr key={i} className="table-row">
                      <td className="table-cell font-medium">{r.nome}</td>
                      <td className="table-cell text-right text-gray-500">
                        {r.quantidade}
                      </td>
                      <td className="table-cell text-right text-gray-500">
                        {r.participacao.toFixed(2)}%
                      </td>
                      <td className="table-cell text-right font-semibold">
                        {formatMoney(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
                  {resumoClientes.map((c, i) => (
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
                  {resumoProdutos.map((p, i) => (
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
                    <th className="table-header">Frete pago</th>
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
