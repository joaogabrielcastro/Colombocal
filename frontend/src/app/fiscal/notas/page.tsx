"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { formatMoney, formatDate, localDateInputValue } from "@/lib/utils";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";
import { toast } from "sonner";
import { NfeStatusBadge } from "@/features/nfe/status";
import { HomologacaoBanner } from "@/features/fiscal/components/HomologacaoBanner";
import { FiscalKpiCards } from "@/features/fiscal/components/FiscalKpiCards";
import { qsFiscal, formatChave } from "@/features/fiscal/services/query";
import type { FiscalFiltros, FiscalNotaLista, FiscalResumo } from "@/features/fiscal/types";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";

const PAGE_SIZE = 20;

export default function FiscalNotasPage() {
  const { nfeEnabled, loading: featLoading } = useTenantFeatures();
  const [filtros, setFiltros] = useState<FiscalFiltros>({
    dataInicio: "",
    dataFim: "",
    status: "",
    numero: "",
    serie: "",
    documento: "",
    venda: "",
    chave: "",
  });
  const [aplicados, setAplicados] = useState<FiscalFiltros | null>(null);
  const [items, setItems] = useState<FiscalNotaLista[]>([]);
  const [resumo, setResumo] = useState<FiscalResumo | null>(null);
  const [ambiente, setAmbiente] = useState<string>("homologacao");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hoje = new Date();
    const ini = localDateInputValue(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    const fim = localDateInputValue(hoje);
    const initial = { ...filtros, dataInicio: ini, dataFim: fim };
    setFiltros(initial);
    setAplicados(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregar = useCallback(async (f: FiscalFiltros, p: number) => {
    setLoading(true);
    try {
      const q = qsFiscal(f);
      const sep = q ? "&" : "?";
      const [lista, r] = await Promise.all([
        api.get<{
          items: FiscalNotaLista[];
          total: number;
          ambiente?: string;
        }>(`/fiscal/notas${q}${sep}page=${p}&pageSize=${PAGE_SIZE}`),
        api.get<FiscalResumo>(`/fiscal/notas/resumo${q}`),
      ]);
      setItems(lista.items || []);
      setTotal(lista.total || 0);
      setAmbiente(lista.ambiente || r.ambiente || "homologacao");
      setResumo(r);
    } catch (err) {
      reportApiError(err, { title: "Não foi possível carregar as NF-e." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!aplicados?.dataInicio || !nfeEnabled) return;
    void carregar(aplicados, page);
  }, [aplicados, page, nfeEnabled, carregar]);

  if (featLoading) {
    return (
      <div className="p-6">
        <TableListSkeleton rows={6} />
      </div>
    );
  }

  if (!nfeEnabled) {
    return (
      <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-semibold text-slate-900">Notas fiscais</h1>
        <p className="mt-2 text-sm text-slate-600">
          O módulo de NF-e não está habilitado nesta organização. Ative em Configurações
          (admin).
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Notas fiscais</h1>
        <p className="text-sm text-slate-600 mt-1">
          Histórico de NF-e do período para conferência. Relatório para envio à contabilidade —
          não substitui o trabalho do contador.
        </p>
      </div>

      <HomologacaoBanner ambiente={ambiente} />

      {aplicados ? (
        <p className="text-sm text-slate-700 mb-3">
          Período:{" "}
          <strong>
            {formatDate(aplicados.dataInicio)} → {formatDate(aplicados.dataFim)}
          </strong>
        </p>
      ) : null}

      <FiscalKpiCards
        resumo={resumo}
        observacao={resumo?.observacaoEmissaoIncerta}
      />

      <div className="card mb-4 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-sm">
            <span className="text-slate-600">Início</span>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Fim</span>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={filtros.dataFim}
              onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Status</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={filtros.status || ""}
              onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="autorizada">Autorizada</option>
              <option value="cancelada">Cancelada</option>
              <option value="rejeitada">Rejeitada</option>
              <option value="processando">Processando</option>
              <option value="denegada">Denegada</option>
              <option value="rascunho">Rascunho</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Número</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={filtros.numero || ""}
              onChange={(e) => setFiltros((f) => ({ ...f, numero: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Série</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={filtros.serie || ""}
              onChange={(e) => setFiltros((f) => ({ ...f, serie: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">CNPJ/CPF</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={filtros.documento || ""}
              onChange={(e) => setFiltros((f) => ({ ...f, documento: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Venda (#)</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={filtros.venda || ""}
              onChange={(e) => setFiltros((f) => ({ ...f, venda: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Chave NF-e</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={filtros.chave || ""}
              onChange={(e) => setFiltros((f) => ({ ...f, chave: e.target.value }))}
            />
          </label>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"
          onClick={() => {
            if (!filtros.dataInicio || !filtros.dataFim) {
              toast.error("Informe o período.");
              return;
            }
            setPage(1);
            setAplicados({ ...filtros });
          }}
        >
          <MagnifyingGlassIcon className="w-4 h-4" />
          Consultar
        </button>
      </div>

      {loading ? (
        <TableListSkeleton rows={8} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Nº</th>
                <th className="px-3 py-2">Série</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Chave</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    Nenhuma NF-e no período.
                  </td>
                </tr>
              ) : (
                items.map((n) => (
                  <tr key={n.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link
                        href={`/fiscal/notas/${n.id}`}
                        className="font-medium text-sky-700 hover:underline"
                      >
                        {n.numero != null
                          ? String(n.numero).padStart(5, "0")
                          : "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{n.serie ?? "—"}</td>
                    <td className="px-3 py-2">
                      {n.dataReferencia ? formatDate(n.dataReferencia) : "—"}
                    </td>
                    <td className="px-3 py-2">{n.cliente?.nome || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(n.valor)}
                    </td>
                    <td className="px-3 py-2">
                      <NfeStatusBadge status={n.status} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs max-w-[220px] truncate" title={n.chaveAcesso || ""}>
                      {n.chaveAcesso ? formatChave(n.chaveAcesso) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-600">
            {total} registro(s) · página {page}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              className="rounded border px-3 py-1 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page * PAGE_SIZE >= total}
              className="rounded border px-3 py-1 disabled:opacity-40"
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
