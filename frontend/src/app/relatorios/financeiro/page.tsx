"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import { formatMoney, formatDate } from "@/lib/utils";
import api from "@/lib/api";
import { apiFetchWithMeta } from "@/lib/api";
import { useExportCsvAsync } from "@/features/relatorios-shared/hooks/useExportCsvAsync";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { TableListSkeleton } from "@/components/ui/skeletons";

interface ContaCliente {
  cliente: { id: number; razaoSocial: string; nomeFantasia?: string };
  saldo: number;
  debito: number;
  /** Soma de valor pago nos títulos a receber (nome técnico na API: credito). */
  credito: number;
}

interface ChequeStatus {
  status: string;
  count: number;
  total: number;
}

interface ChequeItem {
  id: number;
  cliente: { id: number; nomeFantasia?: string; razaoSocial: string };
  valor: number;
  banco: string;
  numero: string;
  dataRecebimento?: string;
  dataCompensacao?: string | null;
  status: string;
}

interface FinanceiroData {
  clientesDevedores: ContaCliente[];
  clientesDevedoresCount?: number;
  totalEmAberto: number;
  chequesPorStatus: ChequeStatus[];
  chequesPendentes: ChequeItem[];
  chequesPendentesCount?: number;
  chequesPendentesValorTotal?: number;
  chequesPendentesListaMax?: number;
  chequesDevolvidos: ChequeItem[];
}

function decimalLikeToNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function normalizeChequesPorStatus(raw: unknown): ChequeStatus[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<string, ChequeStatus>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const status = String(o.status ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

    let count = 0;
    if (typeof o.count === "number") count = o.count;
    else if (o._count && typeof o._count === "object" && o._count !== null) {
      const id = (o._count as { id?: unknown }).id;
      count =
        typeof id === "number" ? id : parseInt(String(id ?? 0), 10) || 0;
    }

    let total = 0;
    if (typeof o.total === "number") total = o.total;
    else if (typeof o.total === "string") total = decimalLikeToNumber(o.total);
    else if (o._sum && typeof o._sum === "object" && o._sum !== null) {
      total = decimalLikeToNumber((o._sum as { valor?: unknown }).valor);
    }

    const cur = merged.get(status) ?? { status, count: 0, total: 0 };
    cur.count += count;
    cur.total += total;
    merged.set(status, cur);
  }
  const order = [
    "ativo",
  ];
  return [...merged.values()].sort((a, b) => {
    const ia = order.indexOf(a.status);
    const ib = order.indexOf(b.status);
    const fa = ia === -1 ? 999 : ia;
    const fb = ib === -1 ? 999 : ib;
    return fa - fb || a.status.localeCompare(b.status);
  });
}

function normalizeFinanceiroPayload(data: FinanceiroData): FinanceiroData {
  const chequesPorStatus = normalizeChequesPorStatus(data.chequesPorStatus);
  let chequesPendentesCount = data.chequesPendentesCount;
  let chequesPendentesValorTotal = data.chequesPendentesValorTotal;
  if (chequesPendentesCount == null) {
    chequesPendentesCount = chequesPorStatus
      .filter((s) => s.status === "ativo")
      .reduce((acc, s) => acc + s.count, 0);
  }
  if (chequesPendentesValorTotal == null) {
    chequesPendentesValorTotal = chequesPorStatus
      .filter((s) => s.status === "ativo")
      .reduce((acc, s) => acc + s.total, 0);
  }
  return {
    ...data,
    chequesPorStatus,
    chequesPendentesCount,
    chequesPendentesValorTotal,
  };
}

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
};

const STATUS_COLOR: Record<string, string> = {
  ativo: "bg-blue-100 text-blue-800",
};

export default function FinanceiroPage() {
  const [dados, setDados] = useState<FinanceiroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"devedores" | "pendentes">(
    "devedores",
  );
  const [pageDevedores, setPageDevedores] = useState(1);
  const [pagePendentes, setPagePendentes] = useState(1);
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
    const page = aba === "devedores" ? pageDevedores : pagePendentes;
    const params = new URLSearchParams({
      aba,
      take: String(pageSize),
      skip: String((page - 1) * pageSize),
    });
    setLoading(true);
    apiFetchWithMeta<FinanceiroData>(`/relatorios/financeiro?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    })
      .then(({ data, meta }) => {
        const normalized = normalizeFinanceiroPayload(data);
        setDados(normalized);
        if (aba === "devedores") {
          setTotalAba(meta.totalCount ?? normalized.clientesDevedoresCount ?? normalized.clientesDevedores.length);
        } else {
          setTotalAba(meta.totalCount ?? normalized.chequesPendentesCount ?? normalized.chequesPendentes.length);
        }
      })
      .finally(() => setLoading(false));
  }, [aba, pageDevedores, pagePendentes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalPages = Math.max(1, Math.ceil(totalAba / pageSize));

  const exportarCSV = () => {
    if (!dados) return;
    let csv = "";
    if (aba === "devedores") {
      csv =
        "Cliente,Débitos,Pagamentos,Em aberto\n" +
        dados.clientesDevedores
          .map(
            (c) =>
              `${(c.cliente.nomeFantasia || c.cliente.razaoSocial).replace(/[,;"]/g, " ")},${c.debito.toFixed(2)},${c.credito.toFixed(2)},${c.saldo.toFixed(2)}`,
          )
          .join("\n");
    } else {
      const lista =
        aba === "pendentes" ? dados.chequesPendentes : dados.chequesDevolvidos;
      csv =
        "Cliente,Banco,Número,Pre-datado,Compensação,Valor,Status\n" +
        lista
          .map((c) =>
            [
              (c.cliente.nomeFantasia || c.cliente.razaoSocial).replace(
                /[,;"]/g,
                " ",
              ),
              c.banco.replace(/[,;"]/g, " "),
              c.numero,
              formatDate(c.dataRecebimento),
              c.dataCompensacao ? formatDate(c.dataCompensacao) : "",
              parseFloat(String(c.valor)).toFixed(2),
              c.status,
            ].join(","),
          )
          .join("\n");
    }
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${aba}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarCsvAsync = async () => {
    await exportCsv({ aba });
  };

  const imprimirRelatorio = () => {
    const tituloAnterior = document.title;
    document.title = `Relatório Financeiro - ${aba}`;
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
            Os valores de <strong>clientes devedores</strong> vêm da{" "}
            <strong>carteira de títulos</strong> (valor original − pago em cada
            título), não da mesma conta corrente “vendas − pagamentos” da ficha
            do cliente.
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
          {/* Cards topo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500">Total em Aberto</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatMoney(dados.totalEmAberto)}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500">Clientes Devendo</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {dados.clientesDevedores.length}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500">Cheques Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">
                {dados.chequesPendentesCount ?? dados.chequesPendentes.length}
              </p>
            </div>
          </div>

          {/* Status cheques — totais reais (API mapeia _sum/_count do Prisma) */}
          <FilterBar className="p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Cheques por Status
            </h3>
            {dados.chequesPorStatus.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum cheque cadastrado.</p>
            ) : (
              <div className="flex gap-3 flex-wrap">
                {dados.chequesPorStatus.map((s) => (
                  <div
                    key={s.status}
                    className={`px-3 py-2 rounded-lg text-sm ${STATUS_COLOR[s.status] || "bg-gray-100 text-gray-700"}`}
                  >
                    <span className="font-medium">
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                    <span className="mx-1">·</span>
                    <span>{s.count}</span>
                    <span className="mx-1">·</span>
                    <span>{formatMoney(s.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </FilterBar>

          {/* Abas */}
          <div className="flex gap-1 mb-4 border-b border-gray-200">
            {(
              [
                {
                  key: "devedores",
                  label: `Clientes Devedores (${dados.clientesDevedoresCount ?? dados.clientesDevedores.length})`,
                },
                {
                  key: "pendentes",
                  label: `Cheques Pendentes (${dados.chequesPendentesCount ?? dados.chequesPendentes.length})`,
                },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setAba(t.key);
                  if (t.key === "devedores") {
                    setPageDevedores(1);
                  } else {
                    setPagePendentes(1);
                  }
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${aba === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {aba === "devedores" && (
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
                                {c.cliente.nomeFantasia ||
                                  c.cliente.razaoSocial}
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
          )}

          {aba === "pendentes" && (
            <div className="card overflow-hidden">
              {(dados.chequesPendentesCount ?? dados.chequesPendentes.length) ===
              0 ? (
                <div className="p-4">
                  <EmptyState
                    title="Nenhum cheque pendente"
                    description="Todos os cheques estão compensados ou sem pendência."
                  />
                </div>
              ) : (
                <>
                  {dados.chequesPendentesListaMax != null &&
                    (dados.chequesPendentesCount ?? 0) >
                      dados.chequesPendentesListaMax && (
                      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 text-sm text-amber-950">
                        Lista limitada aos primeiros{" "}
                        {dados.chequesPendentesListaMax} registros. Total no
                        sistema:{" "}
                        <strong>{dados.chequesPendentesCount}</strong> cheques —{" "}
                        <Link href="/cheques" className="text-blue-700 underline font-medium">
                          ver todos em Cheques
                        </Link>
                        .
                      </div>
                    )}
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Cliente</th>
                      <th className="table-header">Banco</th>
                      <th className="table-header">Número</th>
                      <th className="table-header">Pré-datado</th>
                      <th className="table-header">Compensação</th>
                      <th className="table-header">Status</th>
                      <th className="table-header text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.chequesPendentes.map((c) => (
                      <tr key={c.id} className="table-row">
                        <td className="table-cell">
                          {c.cliente.nomeFantasia || c.cliente.razaoSocial}
                        </td>
                        <td className="table-cell">{c.banco}</td>
                        <td className="table-cell">{c.numero}</td>
                        <td className="table-cell">
                          {formatDate(c.dataRecebimento)}
                        </td>
                        <td className="table-cell">
                          {c.dataCompensacao
                            ? formatDate(c.dataCompensacao)
                            : "—"}
                        </td>
                        <td className="table-cell">
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLOR[c.status]}`}
                          >
                            {STATUS_LABEL[c.status]}
                          </span>
                        </td>
                        <td className="table-cell text-right font-semibold">
                          {formatMoney(c.valor)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold">
                      <td className="table-cell" colSpan={6}>
                        Total
                        {dados.chequesPendentesValorTotal != null &&
                        (dados.chequesPendentesCount ?? 0) >
                          dados.chequesPendentes.length
                          ? " (lista parcial — total geral no cartão acima)"
                          : ""}
                      </td>
                      <td className="table-cell text-right">
                        {formatMoney(
                          dados.chequesPendentesValorTotal ??
                            dados.chequesPendentes.reduce(
                              (s, c) => s + parseFloat(String(c.valor)),
                              0,
                            ),
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
                </>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <p>Total de registros (aba): {totalAba}</p>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary"
                disabled={(aba === "devedores" ? pageDevedores : pagePendentes) <= 1}
                onClick={() => {
                  if (aba === "devedores") {
                    setPageDevedores((p) => Math.max(1, p - 1));
                  } else {
                    setPagePendentes((p) => Math.max(1, p - 1));
                  }
                }}
              >
                Anterior
              </button>
              <span>
                Página {aba === "devedores" ? pageDevedores : pagePendentes} de {totalPages}
              </span>
              <button
                className="btn-secondary"
                disabled={(aba === "devedores" ? pageDevedores : pagePendentes) >= totalPages}
                onClick={() => {
                  if (aba === "devedores") {
                    setPageDevedores((p) => Math.min(totalPages, p + 1));
                  } else {
                    setPagePendentes((p) => Math.min(totalPages, p + 1));
                  }
                }}
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
