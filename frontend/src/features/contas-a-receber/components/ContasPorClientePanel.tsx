"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowPathIcon,
  PrinterIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { formatMoney, type Vendedor } from "@/lib/utils";
import api, { apiFetchWithMeta } from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { FilterBar } from "@/components/ui/filter-bar";
import { toast } from "sonner";
import { reportApiError } from "@/lib/report-api-error";
import { useExportCsvAsync } from "@/features/relatorios-shared/hooks/useExportCsvAsync";
import { CONTAS_PAGE_SIZE } from "../constants";
import { downloadXlsx, nomeArquivoExcel } from "../services/exportExcel";
import { fetchTodasPaginas } from "../services/fetchPaginas";
import { formatPct, labelMaiorAtraso, labelOrdenarClientes } from "../services/display";
import { ContasAgingFaixas } from "./ContasAgingFaixas";
import { ContasKpiCards, kpisCarteiraClientes } from "./ContasKpiCards";
import { ContasPrintMeta } from "./ContasPrintMeta";
import type { ContaCliente, FinanceiroData, OrdenarClientes } from "../types";

export function ContasPorClientePanel() {
  const [dados, setDados] = useState<FinanceiroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [page, setPage] = useState(1);
  const [totalAba, setTotalAba] = useState(0);
  const [buscaDraft, setBuscaDraft] = useState("");
  const [busca, setBusca] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [ordenar, setOrdenar] = useState<OrdenarClientes>("saldo");
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [exportando, setExportando] = useState(false);
  const csv = useExportCsvAsync({ startPath: "/relatorios/financeiro/export-async" });
  const pageSize = CONTAS_PAGE_SIZE;
  const filtrado = Boolean(busca || vendedorId);

  useEffect(() => {
    api
      .get<Vendedor[]>("/vendedores?take=500")
      .then(setVendedores)
      .catch(() => setVendedores([]));
  }, []);

  const carregar = useCallback(() => {
    const params = new URLSearchParams({
      take: String(pageSize),
      skip: String((page - 1) * pageSize),
      ordenar,
    });
    if (busca.trim()) params.set("busca", busca.trim());
    if (vendedorId) params.set("vendedorId", vendedorId);
    setLoading(true);
    setErro("");
    apiFetchWithMeta<FinanceiroData>(`/relatorios/financeiro?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    })
      .then(({ data, meta }) => {
        setDados(data);
        setTotalAba(
          meta.totalCount ??
            data.clientesDevedoresCount ??
            data.clientesDevedores.length,
        );
      })
      .catch((e) => {
        setErro("Não foi possível carregar as contas a receber.");
        reportApiError(e, {
          title: "Erro ao carregar contas a receber",
          onRetry: () => carregar(),
        });
      })
      .finally(() => setLoading(false));
  }, [page, busca, vendedorId, ordenar, pageSize]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalPages = Math.max(1, Math.ceil(totalAba / pageSize));
  const nomeRepresentante =
    vendedores.find((v) => String(v.id) === vendedorId)?.nome || "";

  const paramsFiltro = () => {
    const params = new URLSearchParams();
    if (busca.trim()) params.set("busca", busca.trim());
    if (vendedorId) params.set("vendedorId", vendedorId);
    params.set("ordenar", ordenar);
    return params;
  };

  const exportarExcel = async () => {
    setExportando(true);
    try {
      const { items, truncated } = await fetchTodasPaginas<FinanceiroData>({
        path: "/relatorios/financeiro",
        params: paramsFiltro(),
        pick: (data) => data.clientesDevedores,
        totalFrom: (data, metaTotal) =>
          metaTotal ?? data.clientesDevedoresCount ?? data.clientesDevedores.length,
      });
      const rows = (items as ContaCliente[]).map((c) => ({
        Cliente: c.cliente.nomeFantasia || c.cliente.razaoSocial,
        Representante: c.cliente.vendedor?.nome || "—",
        "Original (títulos)": c.debito,
        "Pago (títulos)": c.credito,
        "Em aberto (títulos)": c.saldo,
        "Participação %": Number(c.participacao || 0),
        "Títulos em aberto": Number(c.titulosAbertos || 0),
        "Maior atraso (dias)": Number(c.maiorAtrasoDias || 0),
      }));
      downloadXlsx(nomeArquivoExcel("contas-receber-clientes"), "Por cliente", rows);
      if (truncated) {
        toast.message("Excel limitado aos primeiros 5.000 clientes do filtro.");
      }
    } catch {
      toast.error("Não foi possível gerar o Excel.");
    } finally {
      setExportando(false);
    }
  };

  const exportarCsv = async () => {
    await csv.exportCsv({
      busca: busca.trim(),
      vendedorId,
      ordenar,
    });
  };

  const imprimirRelatorio = () => {
    const tituloAnterior = document.title;
    document.title = "Contas a receber — por cliente";
    window.print();
    document.title = tituloAnterior;
  };

  function aplicarBusca(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setBusca(buscaDraft.trim());
  }

  function limparBusca() {
    setBuscaDraft("");
    setBusca("");
    setVendedorId("");
    setOrdenar("saldo");
    setPage(1);
  }

  const kpis = dados
    ? kpisCarteiraClientes({
        totalEmAberto: dados.totalEmAberto,
        clientes: dados.clientesDevedoresCount ?? dados.clientesDevedores.length,
        totalVencido: dados.totalVencido,
        totalAVencer: dados.totalAVencer,
        pctVencido: dados.pctVencido,
        filtrado,
      })
    : [];

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 leading-relaxed max-w-3xl print:hidden">
        Saldo em aberto por cliente (valor original − pago nos títulos). Cheques
        cadastrados já entram como pagamento e abatem o saldo.
      </p>

      <ContasPrintMeta
        visao="Por cliente"
        linhas={[
          busca ? `Cliente contém “${busca}”` : "",
          nomeRepresentante ? `Representante: ${nomeRepresentante}` : "",
          `Ordenação: ${labelOrdenarClientes(ordenar)}`,
        ]}
      />

      <FilterBar className="p-4 sm:p-5 mb-0 print:hidden">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <form
            onSubmit={aplicarBusca}
            className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0"
          >
            <div className="flex-1 min-w-0 max-w-xl">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar cliente
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  className="input-field pl-9"
                  placeholder="Razão social, fantasia ou documento…"
                  value={buscaDraft}
                  onChange={(e) => setBuscaDraft(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full sm:w-56 shrink-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Representante
              </label>
              <select
                value={vendedorId}
                onChange={(e) => {
                  setVendedorId(e.target.value);
                  setPage(1);
                }}
                className="input-field w-full"
              >
                <option value="">Todos</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-56 shrink-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ordenar ranking
              </label>
              <select
                value={ordenar}
                onChange={(e) => {
                  setOrdenar(e.target.value as OrdenarClientes);
                  setPage(1);
                }}
                className="input-field w-full"
              >
                <option value="saldo">Maior valor em aberto</option>
                <option value="atraso">Maior atraso</option>
                <option value="titulos">Mais títulos</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2 sm:items-end sm:pb-0.5">
              <button type="submit" className="btn-primary">
                Buscar
              </button>
              {busca || vendedorId || ordenar !== "saldo" ? (
                <button type="button" className="btn-secondary" onClick={limparBusca}>
                  Limpar
                </button>
              ) : null}
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={carregar}
              disabled={loading}
              className="btn-secondary flex items-center gap-1.5"
              title="Atualiza os números do servidor"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Recarregar
            </button>
            {dados ? (
              <>
                <button
                  type="button"
                  onClick={imprimirRelatorio}
                  className="btn-secondary flex items-center gap-1.5"
                >
                  <PrinterIcon className="w-4 h-4" /> Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => void exportarExcel()}
                  disabled={exportando}
                  className="btn-secondary flex items-center gap-1.5"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  {exportando ? "Gerando Excel..." : "Exportar Excel"}
                </button>
                <button
                  type="button"
                  onClick={() => void exportarCsv()}
                  disabled={csv.isExporting}
                  className="btn-secondary flex items-center gap-1.5"
                >
                  {csv.isExporting ? "Gerando CSV..." : "Exportar CSV"}
                </button>
              </>
            ) : null}
          </div>
        </div>
        {csv.error ? <p className="mt-2 text-sm text-red-600">{csv.error}</p> : null}
      </FilterBar>

      {filtrado ? (
        <p className="text-xs text-gray-500 print:hidden">
          Filtros aplicados sobre todo o conjunto, não só a página atual.
        </p>
      ) : null}

      {loading && !dados ? (
        <div className="card p-5">
          <TableListSkeleton rows={10} cols={7} />
        </div>
      ) : null}

      {erro && !dados ? (
        <EmptyState
          title="Não foi possível carregar o ranking"
          description={erro}
          action={
            <button type="button" className="btn-primary" onClick={carregar}>
              Tentar novamente
            </button>
          }
        />
      ) : null}

      {dados ? (
        <>
          <ContasKpiCards items={kpis} />
          {dados.faixas ? <ContasAgingFaixas faixas={dados.faixas} /> : null}

          <div className="card overflow-hidden">
            {dados.clientesDevedores.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title={
                    filtrado
                      ? "Nenhum cliente encontrado para os filtros selecionados."
                      : "Nenhum cliente com saldo devedor"
                  }
                  description={
                    filtrado
                      ? "Tente outro termo, representante ou limpe os filtros."
                      : "Quando houver títulos em aberto, eles aparecerão aqui."
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px]">
                  <thead>
                    <tr className="border-b border-gray-200 bg-slate-50/80">
                      <th className="table-header text-left px-4 py-3.5 w-[28%]">
                        Cliente
                      </th>
                      <th className="table-header text-right px-4 py-3.5">Original</th>
                      <th className="table-header text-right px-4 py-3.5">Pago</th>
                      <th className="table-header text-right px-4 py-3.5">Em aberto</th>
                      <th className="table-header text-right px-4 py-3.5">Participação</th>
                      <th className="table-header text-right px-4 py-3.5">Títulos</th>
                      <th className="table-header text-right px-4 py-3.5">
                        Maior atraso
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.clientesDevedores.map((c) => (
                      <tr key={c.cliente.id} className="table-row">
                        <td className="table-cell px-4 py-3.5">
                          <Link
                            href={`/clientes/${c.cliente.id}?aba=conta`}
                            className="text-blue-600 hover:underline font-medium"
                            title={c.cliente.nomeFantasia || c.cliente.razaoSocial}
                          >
                            {c.cliente.nomeFantasia || c.cliente.razaoSocial}
                          </Link>
                          {c.cliente.vendedor?.nome ? (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {c.cliente.vendedor.nome}
                            </div>
                          ) : null}
                        </td>
                        <td className="table-cell text-right px-4 py-3.5 tabular-nums">
                          {formatMoney(c.debito)}
                        </td>
                        <td className="table-cell text-right px-4 py-3.5 tabular-nums">
                          {formatMoney(c.credito)}
                        </td>
                        <td className="table-cell text-right px-4 py-3.5 font-semibold tabular-nums text-gray-900">
                          {formatMoney(c.saldo)}
                        </td>
                        <td className="table-cell text-right px-4 py-3.5 tabular-nums text-gray-700">
                          {formatPct(Number(c.participacao || 0))}
                        </td>
                        <td className="table-cell text-right px-4 py-3.5 tabular-nums">
                          {c.titulosAbertos ?? "—"}
                        </td>
                        <td
                          className={`table-cell text-right px-4 py-3.5 tabular-nums ${
                            (c.maiorAtrasoDias || 0) > 0 ? "text-red-700" : "text-gray-600"
                          }`}
                        >
                          {labelMaiorAtraso(Number(c.maiorAtrasoDias || 0))}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold border-t border-gray-200">
                      <td className="table-cell px-4 py-3.5" colSpan={3}>
                        Total em aberto{filtrado ? " (filtro)" : ""}
                      </td>
                      <td className="table-cell text-right px-4 py-3.5 tabular-nums">
                        {formatMoney(dados.totalEmAberto)}
                      </td>
                      <td className="table-cell px-4 py-3.5" colSpan={3} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600 print:hidden">
            <p>
              {totalAba} cliente(s){filtrado ? " no filtro" : ""} · {pageSize} por página
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
