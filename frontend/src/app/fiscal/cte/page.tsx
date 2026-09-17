"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { formatMoney, formatDate, localDateInputValue } from "@/lib/utils";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";
import { HomologacaoBanner } from "@/features/fiscal/components/HomologacaoBanner";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";

type CteRow = {
  id: number;
  numero?: number | null;
  serie?: number | null;
  status: string;
  emitidaEm?: string | null;
  remetenteNome?: string | null;
  destinatarioNome?: string | null;
  origemMunicipio?: string | null;
  origemUf?: string | null;
  destinoMunicipio?: string | null;
  destinoUf?: string | null;
  valorServico?: number | null;
};

export default function FiscalCteListPage() {
  const { cteEnabled, loading: featLoading } = useTenantFeatures();
  const [items, setItems] = useState<CteRow[]>([]);
  const [status, setStatus] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hoje = new Date();
    setDataInicio(localDateInputValue(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
    setDataFim(localDateInputValue(hoje));
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (dataInicio) q.set("dataInicio", dataInicio);
      if (dataFim) q.set("dataFim", dataFim);
      if (status) q.set("status", status);
      const rows = await api.get<CteRow[]>(`/fiscal/cte?${q.toString()}`);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      reportApiError(err, { title: "Não foi possível carregar os CT-e." });
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, status]);

  useEffect(() => {
    if (!cteEnabled || !dataInicio) return;
    void carregar();
  }, [cteEnabled, dataInicio, carregar]);

  if (featLoading) return <TableListSkeleton />;
  if (!cteEnabled) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">Módulo CT-e desabilitado nesta organização.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold text-gray-900">CT-e</h1>
        <Link href="/fiscal/cte/nova" className="btn-primary text-sm">
          Emitir CT-e
        </Link>
      </div>
      <HomologacaoBanner ambiente="homologacao" />
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">
          De
          <input
            type="date"
            className="input ml-1"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Até
          <input
            type="date"
            className="input ml-1"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Status
          <select
            className="input ml-1"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="autorizada">Autorizada</option>
            <option value="processando">Processando</option>
            <option value="rejeitada">Rejeitada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>
        <button type="button" className="btn-secondary text-sm" onClick={() => void carregar()}>
          Filtrar
        </button>
      </div>
      {loading ? (
        <TableListSkeleton />
      ) : (
        <div className="overflow-x-auto card">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="p-3">Número</th>
                <th className="p-3">Série</th>
                <th className="p-3">Emissão</th>
                <th className="p-3">Remetente</th>
                <th className="p-3">Destinatário</th>
                <th className="p-3">Origem</th>
                <th className="p-3">Destino</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3">
                    <Link className="text-blue-700 hover:underline" href={`/fiscal/cte/${row.id}`}>
                      {row.numero ?? "—"}
                    </Link>
                  </td>
                  <td className="p-3">{row.serie ?? "—"}</td>
                  <td className="p-3">{row.emitidaEm ? formatDate(row.emitidaEm) : "—"}</td>
                  <td className="p-3">{row.remetenteNome || "—"}</td>
                  <td className="p-3">{row.destinatarioNome || "—"}</td>
                  <td className="p-3">
                    {[row.origemMunicipio, row.origemUf].filter(Boolean).join("/") || "—"}
                  </td>
                  <td className="p-3">
                    {[row.destinoMunicipio, row.destinoUf].filter(Boolean).join("/") || "—"}
                  </td>
                  <td className="p-3">
                    {row.valorServico != null ? formatMoney(row.valorServico) : "—"}
                  </td>
                  <td className="p-3 capitalize">{row.status}</td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-500">
                    Nenhum CT-e no período.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
