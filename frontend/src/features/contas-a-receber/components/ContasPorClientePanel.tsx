"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PrinterIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { formatMoney } from "@/lib/utils";
import { apiFetchWithMeta } from "@/lib/api";
import { useExportCsvAsync } from "@/features/relatorios-shared/hooks/useExportCsvAsync";
import { EmptyState } from "@/components/ui/empty-state";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { FilterBar } from "@/components/ui/filter-bar";

interface ContaCliente {
  cliente: { id: number; razaoSocial: string; nomeFantasia?: string };
  saldo: number;
  debito: number;
  credito: number;
}

interface FinanceiroData {
  clientesDevedores: ContaCliente[];
  clientesDevedoresCount?: number;
  totalEmAberto: number;
}

/** Visão agregada: quem deve e quanto (carteira de títulos). */
export function ContasPorClientePanel() {
  const [dados, setDados] = useState<FinanceiroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalAba, setTotalAba] = useState(0);
  const [buscaDraft, setBuscaDraft] = useState("");
  const [busca, setBusca] = useState("");
  const {
    isExporting: exportandoCsv,
    error: erroExportacao,
    exportCsv,
  } = useExportCsvAsync({
    startPath: "/relatorios/financeiro/export-async",
    maxAttempts: 60,
    pollIntervalMs: 1000,
    fallback: () => {
      if (dados) exportarCSV();
    },
  });
  const pageSize = 100;

  const carregar = useCallback(() => {
    const params = new URLSearchParams({
      take: String(pageSize),
      skip: String((page - 1) * pageSize),
    });
    if (busca.trim()) params.set("busca", busca.trim());
    setLoading(true);
    apiFetchWithMeta<FinanceiroData>(
      `/relatorios/financeiro?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
      },
    )
      .then(({ data, meta }) => {
        setDados(data);
        setTotalAba(
          meta.totalCount ??
            data.clientesDevedoresCount ??
            data.clientesDevedores.length,
        );
      })
      .finally(() => setLoading(false));
  }, [page, busca]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalPages = Math.max(1, Math.ceil(totalAba / pageSize));

  const exportarCSV = () => {
    if (!dados) return;
    const csv =
      "Cliente,Débitos,Pagamentos,Em aberto\n" +
      dados.clientesDevedores
        .map(
          (c) =>
            `${(c.cliente.nomeFantasia || c.cliente.razaoSocial).replace(/[,;"]/g, " ")},${c.debito.toFixed(2)},${c.credito.toFixed(2)},${c.saldo.toFixed(2)}`,
        )
        .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "financeiro-devedores.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarCsvAsync = async () => {
    await exportCsv({});
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
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
        Saldo em aberto por cliente (valor original − pago nos títulos). Cheques
        cadastrados já entram como pagamento e abatem o saldo.
      </p>

      <FilterBar className="p-4 sm:p-5 mb-0">
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
            <div className="flex flex-wrap gap-2 sm:items-end sm:pb-0.5">
              <button type="submit" className="btn-primary">
                Buscar
              </button>
              {busca ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={limparBusca}
                >
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
              <ArrowPathIcon
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
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
                  onClick={() => void exportarCsvAsync()}
                  disabled={exportandoCsv}
                  className="btn-secondary flex items-center gap-1.5"
                >
                  {exportandoCsv ? "Gerando CSV..." : "Exportar CSV"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </FilterBar>

      {erroExportacao ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {erroExportacao}
        </div>
      ) : null}

      {loading ? (
        <div className="card p-5">
          <TableListSkeleton rows={10} cols={4} />
        </div>
      ) : null}

      {!loading && dados ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            <div className="card p-5 sm:p-6">
              <p className="text-sm text-gray-500 mb-1">
                {busca ? "Em aberto (filtro)" : "Total em Aberto"}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-red-600 tracking-tight">
                {formatMoney(dados.totalEmAberto)}
              </p>
            </div>
            <div className="card p-5 sm:p-6">
              <p className="text-sm text-gray-500 mb-1">
                {busca ? "Clientes no filtro" : "Clientes Devendo"}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                {dados.clientesDevedoresCount ?? dados.clientesDevedores.length}
              </p>
            </div>
          </div>

          <div className="card overflow-hidden">
            {dados.clientesDevedores.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title={
                    busca
                      ? "Nenhum cliente encontrado"
                      : "Nenhum cliente com saldo devedor"
                  }
                  description={
                    busca
                      ? "Tente outro termo ou limpe a busca."
                      : "Quando houver títulos em aberto, eles aparecerão aqui."
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-gray-200 bg-slate-50/80">
                      <th className="table-header text-left px-4 py-3.5 w-[44%]">
                        Cliente
                      </th>
                      <th className="table-header text-right px-4 py-3.5">
                        Original (títulos)
                      </th>
                      <th className="table-header text-right px-4 py-3.5">
                        Pago (títulos)
                      </th>
                      <th className="table-header text-right px-4 py-3.5">
                        Em aberto (títulos)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...dados.clientesDevedores]
                      .sort((a, b) => b.saldo - a.saldo)
                      .map((c) => (
                        <tr key={c.cliente.id} className="table-row">
                          <td className="table-cell px-4 py-3.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <ExclamationTriangleIcon className="w-4 h-4 text-red-400 shrink-0" />
                              <a
                                href={`/clientes/${c.cliente.id}`}
                                className="text-blue-600 hover:underline font-medium truncate"
                                title={
                                  c.cliente.nomeFantasia || c.cliente.razaoSocial
                                }
                              >
                                {c.cliente.nomeFantasia || c.cliente.razaoSocial}
                              </a>
                            </div>
                          </td>
                          <td className="table-cell text-right px-4 py-3.5 tabular-nums">
                            {formatMoney(c.debito)}
                          </td>
                          <td className="table-cell text-right px-4 py-3.5 tabular-nums">
                            {formatMoney(c.credito)}
                          </td>
                          <td className="table-cell text-right px-4 py-3.5 font-bold text-red-600 tabular-nums">
                            {formatMoney(c.saldo)}
                          </td>
                        </tr>
                      ))}
                    <tr className="bg-gray-50 font-bold border-t border-gray-200">
                      <td className="table-cell px-4 py-3.5" colSpan={3}>
                        Total em aberto{busca ? " (filtro)" : " (títulos)"}
                      </td>
                      <td className="table-cell text-right px-4 py-3.5 text-red-600 tabular-nums">
                        {formatMoney(dados.totalEmAberto)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
            <p>
              {totalAba} cliente(s){busca ? " no filtro" : ""}
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
