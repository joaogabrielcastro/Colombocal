"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import { formatMoney } from "@/lib/utils";
import { apiFetchWithMeta } from "@/lib/api";
import { useExportCsvAsync } from "@/features/relatorios-shared/hooks/useExportCsvAsync";
import { EmptyState } from "@/components/ui/empty-state";
import { TableListSkeleton } from "@/components/ui/skeletons";

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

export default function FinanceiroPage() {
  const [dados, setDados] = useState<FinanceiroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalAba, setTotalAba] = useState(0);
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
    setLoading(true);
    apiFetchWithMeta<FinanceiroData>(`/relatorios/financeiro?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    })
      .then(({ data, meta }) => {
        setDados(data);
        setTotalAba(
          meta.totalCount ?? data.clientesDevedoresCount ?? data.clientesDevedores.length,
        );
      })
      .finally(() => setLoading(false));
  }, [page]);

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
    document.title = "Relatório Financeiro";
    window.print();
    document.title = tituloAnterior;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Relatório Financeiro
          </h1>
          <p className="text-gray-500 text-sm mt-1 max-w-2xl">
            Saldo em aberto por cliente com base na{" "}
            <strong>carteira de títulos</strong> (valor original − pago). Cheques
            cadastrados já entram como pagamento e abatem o saldo na hora.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={carregar}
            disabled={loading}
            className="btn-secondary flex items-center gap-1"
            title="Atualiza os números do servidor"
          >
            <ArrowPathIcon
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />{" "}
            Recarregar
          </button>
          {dados && (
            <>
              <button
                onClick={imprimirRelatorio}
                className="btn-secondary flex items-center gap-1"
              >
                <PrinterIcon className="w-4 h-4" /> Imprimir
              </button>
              <button
                onClick={exportarCsvAsync}
                disabled={exportandoCsv}
                className="btn-secondary flex items-center gap-1"
              >
                {exportandoCsv ? "Gerando CSV..." : "Exportar CSV (assíncrono)"}
              </button>
            </>
          )}
        </div>
      </div>

      {erroExportacao ? (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {erroExportacao}
        </div>
      ) : null}

      {loading && (
        <div className="card p-4">
          <TableListSkeleton rows={10} cols={5} />
        </div>
      )}

      {!loading && dados && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500">Total em Aberto</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatMoney(dados.totalEmAberto)}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500">Clientes Devendo</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {dados.clientesDevedoresCount ?? dados.clientesDevedores.length}
              </p>
            </div>
          </div>

          <div className="card overflow-hidden">
            {dados.clientesDevedores.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Nenhum cliente com saldo devedor"
                  description="Quando houver títulos em aberto, eles aparecerão aqui."
                />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Cliente</th>
                    <th className="table-header text-right">
                      Original (títulos)
                    </th>
                    <th className="table-header text-right">
                      Pago (títulos)
                    </th>
                    <th className="table-header text-right">
                      Em aberto (títulos)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dados.clientesDevedores
                    .sort((a, b) => b.saldo - a.saldo)
                    .map((c) => (
                      <tr key={c.cliente.id} className="table-row">
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="w-4 h-4 text-red-400 shrink-0" />
                            <a
                              href={`/clientes/${c.cliente.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {c.cliente.nomeFantasia || c.cliente.razaoSocial}
                            </a>
                          </div>
                        </td>
                        <td className="table-cell text-right">
                          {formatMoney(c.debito)}
                        </td>
                        <td className="table-cell text-right">
                          {formatMoney(c.credito)}
                        </td>
                        <td className="table-cell text-right font-bold text-red-600">
                          {formatMoney(c.saldo)}
                        </td>
                      </tr>
                    ))}
                  <tr className="bg-gray-50 font-bold">
                    <td className="table-cell" colSpan={3}>
                      Total em aberto (títulos)
                    </td>
                    <td className="table-cell text-right text-red-600">
                      {formatMoney(dados.totalEmAberto)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <p>Total de registros: {totalAba}</p>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
