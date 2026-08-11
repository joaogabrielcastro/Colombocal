"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDate, formatMoney, type Cliente } from "@/lib/utils";
import { VendaOrdem, vendaOrdemTexto } from "@/components/VendaOrdem";
import api from "@/lib/api";
import { apiFetchWithMeta } from "@/lib/api";
import { useExportCsvAsync } from "@/features/relatorios-shared/hooks/useExportCsvAsync";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import SearchableSelect from "@/components/SearchableSelect";
import * as XLSX from "xlsx";

interface TituloItem {
  id: number;
  numero?: string | null;
  vencimento: string;
  valorOriginal: number;
  valorPago: number;
  status: "aberto" | "parcial" | "quitado";
  cliente: { id: number; razaoSocial: string; nomeFantasia?: string | null };
  venda?: {
    id: number;
    numeroVenda?: number | null;
    dataVenda: string;
    valorTotal: number;
  } | null;
}

interface TitulosResponse {
  titulos: TituloItem[];
  resumo: {
    totalTitulos: number;
    valorOriginal: number;
    valorPago: number;
    valorEmAberto: number;
    faixas: {
      vencidos: number;
      ate30: number;
      de31a60: number;
      de61a90: number;
      acima90: number;
    };
  };
}

type Props = {
  initialClienteId?: string;
};

/** Visão linha a linha: parcelas/títulos com aging. */
export function ContasPorTituloPanel({ initialClienteId = "" }: Props) {
  const [dados, setDados] = useState<TitulosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 100;

  const [clienteId, setClienteId] = useState(initialClienteId);
  const [vendaIdFiltro, setVendaIdFiltro] = useState("");
  const [status, setStatus] = useState("");
  const [dataVencInicio, setDataVencInicio] = useState("");
  const [dataVencFim, setDataVencFim] = useState("");
  const [somenteEmAberto, setSomenteEmAberto] = useState(true);
  const [ordenarMaiorAtraso, setOrdenarMaiorAtraso] = useState(true);
  const {
    isExporting: exportandoCsv,
    error: erroExportacao,
    exportCsv,
  } = useExportCsvAsync({
    startPath: "/relatorios/titulos/export-async",
    maxAttempts: 60,
    pollIntervalMs: 1000,
  });

  useEffect(() => {
    if (initialClienteId) setClienteId(initialClienteId);
  }, [initialClienteId]);

  const carregar = useCallback(
    async (targetPage = page) => {
      const params = new URLSearchParams();
      if (clienteId) params.set("clienteId", clienteId);
      const vid = vendaIdFiltro.replace(/^#/, "").trim();
      if (vid) params.set("vendaId", vid);
      if (status) params.set("status", status);
      if (dataVencInicio) params.set("dataVencInicio", dataVencInicio);
      if (dataVencFim) params.set("dataVencFim", dataVencFim);
      if (somenteEmAberto) params.set("somenteEmAberto", "true");
      params.set("take", String(pageSize));
      params.set("skip", String((targetPage - 1) * pageSize));
      setLoading(true);
      try {
        const { data, meta } = await apiFetchWithMeta<TitulosResponse>(
          `/relatorios/titulos?${params.toString()}`,
          { method: "GET" },
        );
        setDados(data);
        setTotal(meta.totalCount ?? data.resumo.totalTitulos);
      } finally {
        setLoading(false);
      }
    },
    [clienteId, vendaIdFiltro, status, dataVencInicio, dataVencFim, somenteEmAberto],
  );

  useEffect(() => {
    void carregar(page);
  }, [carregar, page]);

  const loadClienteOptions = useCallback(async (q: string) => {
    const p = new URLSearchParams({ ativo: "true", take: "40" });
    if (q.trim()) p.set("busca", q.trim());
    const r = await api.get<{ clientes: Cliente[] }>(`/clientes?${p}`);
    return r.clientes.map((c) => ({
      id: c.id,
      label: (c.nomeFantasia?.trim() || c.razaoSocial) as string,
    }));
  }, []);

  const loadClienteLabelById = useCallback(async (cid: string) => {
    const c = await api.get<Cliente>(`/clientes/${cid}`);
    return (c.nomeFantasia?.trim() || c.razaoSocial) ?? null;
  }, []);

  const getDiasAtraso = (vencimento: string, valorAberto: number) => {
    if (valorAberto <= 0.009) return 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(vencimento);
    venc.setHours(0, 0, 0, 0);
    const diffMs = hoje.getTime() - venc.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  const titulosOrdenados = [...(dados?.titulos || [])].sort((a, b) => {
    if (!ordenarMaiorAtraso) {
      return new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime();
    }
    const abertoA = Math.max(
      0,
      parseFloat(String(a.valorOriginal)) - parseFloat(String(a.valorPago)),
    );
    const abertoB = Math.max(
      0,
      parseFloat(String(b.valorOriginal)) - parseFloat(String(b.valorPago)),
    );
    const atrasoA = getDiasAtraso(a.vencimento, abertoA);
    const atrasoB = getDiasAtraso(b.vencimento, abertoB);
    if (atrasoB !== atrasoA) return atrasoB - atrasoA;
    return abertoB - abertoA;
  });

  const getExportRows = () =>
    titulosOrdenados.map((t) => {
      const aberto = Math.max(
        0,
        parseFloat(String(t.valorOriginal)) - parseFloat(String(t.valorPago)),
      );
      return {
        titulo: t.numero || `#${t.id}`,
        cliente: t.cliente.nomeFantasia || t.cliente.razaoSocial,
        venda: t.venda ? `Venda ${vendaOrdemTexto(t.venda)}` : "-",
        vencimento: formatDate(t.vencimento),
        valorOriginal: parseFloat(String(t.valorOriginal)),
        valorPago: parseFloat(String(t.valorPago)),
        valorEmAberto: aberto,
        diasAtraso: getDiasAtraso(t.vencimento, aberto),
        status: t.status,
      };
    });

  const exportarCsvAsync = async () => {
    await exportCsv({
      clienteId,
      vendaId: vendaIdFiltro,
      status,
      dataVencInicio,
      dataVencFim,
      somenteEmAberto,
    });
  };

  const exportarExcel = () => {
    if (!dados) return;
    const rows = getExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Titulos");
    XLSX.writeFile(wb, `titulos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
        Parcelas em aberto por título (aging). O valor de uma linha pode diferir do
        saldo global da conta corrente do cliente.
      </p>

      {clienteId ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <Link
            href={`/clientes/${clienteId}?aba=conta`}
            className="font-medium text-blue-700 underline hover:text-blue-900"
          >
            Ver recebimentos deste cliente
          </Link>
        </div>
      ) : null}

      <FilterBar className="p-4 sm:p-5 mb-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-3">
            <SearchableSelect
              label="Cliente"
              value={clienteId}
              onChange={setClienteId}
              loadOptions={loadClienteOptions}
              loadLabelById={loadClienteLabelById}
              minChars={0}
              placeholder="Todos os clientes"
              emptyHint="Digite para buscar ou deixe em branco para todos."
            />
          </div>
          <div className="xl:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nº venda (ordem)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={vendaIdFiltro}
              onChange={(e) => setVendaIdFiltro(e.target.value)}
              className="input-field font-mono"
              placeholder="ex: 1840"
            />
          </div>
          <div className="xl:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-field"
            >
              <option value="">Todos</option>
              <option value="aberto">Aberto</option>
              <option value="parcial">Parcial</option>
              <option value="quitado">Quitado</option>
            </select>
          </div>
          <div className="xl:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venc. início
            </label>
            <input
              type="date"
              value={dataVencInicio}
              onChange={(e) => setDataVencInicio(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="xl:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venc. fim
            </label>
            <input
              type="date"
              value={dataVencFim}
              onChange={(e) => setDataVencFim(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="xl:col-span-1 flex items-end">
            <button
              type="button"
              onClick={() => {
                if (page === 1) {
                  void carregar(1);
                } else {
                  setPage(1);
                }
              }}
              className="btn-primary w-full"
            >
              Filtrar
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={somenteEmAberto}
              onChange={(e) => setSomenteEmAberto(e.target.checked)}
            />
            Somente em aberto (aberto/parcial)
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={ordenarMaiorAtraso}
              onChange={(e) => setOrdenarMaiorAtraso(e.target.checked)}
            />
            Ordenar por maior atraso
          </label>
          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              type="button"
              onClick={() => void exportarCsvAsync()}
              disabled={exportandoCsv}
              className="btn-secondary"
            >
              {exportandoCsv ? "Gerando CSV..." : "Exportar CSV"}
            </button>
            <button type="button" onClick={exportarExcel} className="btn-secondary">
              Exportar Excel
            </button>
          </div>
        </div>
      </FilterBar>

      {erroExportacao ? (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {erroExportacao}
        </div>
      ) : null}

      {dados ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3 lg:gap-4 mb-5">
          <div className="card p-4 text-center min-w-0">
            <p className="text-xs text-gray-500 mb-1">Títulos</p>
            <p className="text-lg font-bold tabular-nums">{dados.resumo.totalTitulos}</p>
          </div>
          <div className="card p-4 text-center min-w-0">
            <p className="text-xs text-gray-500 mb-1">Em Aberto</p>
            <p className="text-lg font-bold text-red-600 tabular-nums">
              {formatMoney(dados.resumo.valorEmAberto)}
            </p>
          </div>
          <div className="card p-4 text-center min-w-0">
            <p className="text-xs text-gray-500 mb-1">Vencidos</p>
            <p className="text-lg font-bold text-red-700 tabular-nums">
              {formatMoney(dados.resumo.faixas.vencidos)}
            </p>
          </div>
          <div className="card p-4 text-center min-w-0">
            <p className="text-xs text-gray-500 mb-1">0-30 dias</p>
            <p className="text-lg font-bold tabular-nums">
              {formatMoney(dados.resumo.faixas.ate30)}
            </p>
          </div>
          <div className="card p-4 text-center min-w-0">
            <p className="text-xs text-gray-500 mb-1">31-60</p>
            <p className="text-lg font-bold tabular-nums">
              {formatMoney(dados.resumo.faixas.de31a60)}
            </p>
          </div>
          <div className="card p-4 text-center min-w-0">
            <p className="text-xs text-gray-500 mb-1">61-90</p>
            <p className="text-lg font-bold tabular-nums">
              {formatMoney(dados.resumo.faixas.de61a90)}
            </p>
          </div>
          <div className="card p-4 text-center min-w-0">
            <p className="text-xs text-gray-500 mb-1">90+</p>
            <p className="text-lg font-bold tabular-nums">
              {formatMoney(dados.resumo.faixas.acima90)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-5">
            <TableListSkeleton rows={12} cols={6} />
          </div>
        ) : !dados || dados.titulos.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Nenhum título encontrado"
              description="Ajuste os filtros ou remova restrições para visualizar títulos."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b border-gray-200 bg-slate-50/80">
                  <th className="table-header text-left px-4 py-3.5 whitespace-nowrap">
                    Título
                  </th>
                  <th className="table-header text-left px-4 py-3.5 min-w-[220px] w-[28%]">
                    Cliente
                  </th>
                  <th className="table-header text-left px-4 py-3.5 w-32 bg-slate-50">
                    Ordem
                  </th>
                  <th className="table-header text-left px-4 py-3.5 whitespace-nowrap">
                    Vencimento
                  </th>
                  <th className="table-header text-right px-4 py-3.5">Original</th>
                  <th className="table-header text-right px-4 py-3.5">Pago</th>
                  <th className="table-header text-right px-4 py-3.5">Aberto</th>
                  <th className="table-header text-left px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {titulosOrdenados.map((t) => {
                  const aberto = Math.max(
                    0,
                    parseFloat(String(t.valorOriginal)) - parseFloat(String(t.valorPago)),
                  );
                  const diasAtraso = getDiasAtraso(t.vencimento, aberto);
                  return (
                    <tr key={t.id} className="table-row">
                      <td className="table-cell px-4 py-3.5 font-mono whitespace-nowrap">
                        {t.numero || `#${t.id}`}
                      </td>
                      <td className="table-cell px-4 py-3.5">
                        <Link
                          href={`/clientes/${t.cliente.id}`}
                          className="text-blue-600 hover:underline font-medium"
                          title={t.cliente.nomeFantasia || t.cliente.razaoSocial}
                        >
                          {t.cliente.nomeFantasia || t.cliente.razaoSocial}
                        </Link>
                        <div className="mt-0.5">
                          <Link
                            href={`/financeiro/novo?clienteId=${t.cliente.id}`}
                            className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
                          >
                            Receber
                          </Link>
                        </div>
                      </td>
                      <td className="table-cell px-4 py-3.5">
                        {t.venda ? (
                          <VendaOrdem venda={t.venda} size="sm" prefix="Venda" />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="table-cell px-4 py-3.5 whitespace-nowrap">
                        {formatDate(t.vencimento)}
                      </td>
                      <td className="table-cell text-right px-4 py-3.5 tabular-nums">
                        {formatMoney(t.valorOriginal)}
                      </td>
                      <td className="table-cell text-right px-4 py-3.5 tabular-nums">
                        {formatMoney(t.valorPago)}
                      </td>
                      <td className="table-cell text-right px-4 py-3.5 font-semibold text-red-600 tabular-nums">
                        {formatMoney(aberto)}
                        {diasAtraso > 0 ? (
                          <div className="text-xs font-normal text-red-500">
                            {diasAtraso} dias
                          </div>
                        ) : null}
                      </td>
                      <td className="table-cell px-4 py-3.5">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                            t.status === "quitado"
                              ? "bg-green-100 text-green-700"
                              : t.status === "parcial"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
        <p>Total de registros (filtro): {total}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
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
            type="button"
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
