"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { formatDate, localDateInputValue } from "@/lib/utils";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";
import { HomologacaoBanner } from "@/features/fiscal/components/HomologacaoBanner";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { EmptyState } from "@/components/ui/empty-state";

type MdfeRow = {
  id: number;
  numero?: number | null;
  serie?: number | null;
  status: string;
  emitidaEm?: string | null;
  ufInicio?: string | null;
  ufFim?: string | null;
  veiculoPlaca?: string | null;
  motoristaNome?: string | null;
};

export default function FiscalMdfeListPage() {
  const { mdfeEnabled, loading: featLoading } = useTenantFeatures();
  const [items, setItems] = useState<MdfeRow[]>([]);
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
      const rows = await api.get<MdfeRow[]>(`/fiscal/mdfe?${q.toString()}`);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      reportApiError(err, { title: "Não foi possível carregar os MDF-e." });
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, status]);

  useEffect(() => {
    if (!mdfeEnabled || !dataInicio) return;
    void carregar();
  }, [mdfeEnabled, dataInicio, carregar]);

  if (featLoading) return <TableListSkeleton />;
  if (!mdfeEnabled) {
    return <div className="page-container max-w-xl"><EmptyState title="Módulo MDF-e desabilitado" description="Ative o módulo nas configurações da organização para emitir e consultar MDF-e." /></div>;
  }

  return (
    <div className="page-container space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold text-gray-900">MDF-e</h1><p className="mt-1 text-sm text-gray-500">Emissão e acompanhamento de manifestos eletrônicos.</p></div>
        <Link href="/fiscal/mdfe/nova" className="btn-primary text-sm">
          Emitir MDF-e
        </Link>
      </div>
      <HomologacaoBanner ambiente="homologacao" />
      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <label className="field-label" htmlFor="mdfe-data-inicio">Data inicial<input id="mdfe-data-inicio" type="date" className="input-field mt-1" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></label>
        <label className="field-label" htmlFor="mdfe-data-fim">Data final<input id="mdfe-data-fim" type="date" className="input-field mt-1" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></label>
        <label className="field-label" htmlFor="mdfe-status">Status<select id="mdfe-status" className="input-field mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Status</option>
          <option value="autorizada">Autorizada</option>
          <option value="encerrada">Encerrada</option>
          <option value="cancelada">Cancelada</option>
          <option value="processando">Processando</option>
        </select></label>
        <button type="button" className="btn-secondary text-sm" onClick={() => void carregar()} disabled={loading}>
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
                <th className="p-3">Emissão</th>
                <th className="p-3">UF</th>
                <th className="p-3">Veículo</th>
                <th className="p-3">Motorista</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-3">
                    <Link className="text-blue-700 hover:underline" href={`/fiscal/mdfe/${row.id}`}>
                      {row.numero ?? row.id}
                    </Link>
                  </td>
                  <td className="p-3">{row.emitidaEm ? formatDate(row.emitidaEm) : "—"}</td>
                  <td className="p-3">
                    {row.ufInicio || "—"} → {row.ufFim || "—"}
                  </td>
                  <td className="p-3">{row.veiculoPlaca || "—"}</td>
                  <td className="p-3">{row.motoristaNome || "—"}</td>
                  <td className="p-3 capitalize">{row.status}</td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={6}><EmptyState compact title="Nenhum MDF-e no período" description="Ajuste os filtros ou emita um novo MDF-e." /></td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
