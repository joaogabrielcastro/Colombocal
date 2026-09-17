"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { formatMoney, formatDate, localDateInputValue } from "@/lib/utils";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";
import { HomologacaoBanner } from "@/features/fiscal/components/HomologacaoBanner";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";

type CiotRow = {
  id: number;
  codigoCiot?: string | null;
  status: string;
  dataOperacao?: string | null;
  transportadorNome?: string | null;
  motoristaNome?: string | null;
  veiculoPlaca?: string | null;
  origemMunicipio?: string | null;
  origemUf?: string | null;
  destinoMunicipio?: string | null;
  destinoUf?: string | null;
  valorOperacao?: number | null;
};

export default function FiscalCiotListPage() {
  const { ciotEnabled, loading: featLoading } = useTenantFeatures();
  const [items, setItems] = useState<CiotRow[]>([]);
  const [provider, setProvider] = useState("");
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
      const res = await api.get<{ items: CiotRow[]; provider?: string }>(
        `/fiscal/ciot?${q.toString()}`,
      );
      setItems(res.items || []);
      setProvider(res.provider || "");
    } catch (err) {
      reportApiError(err, { title: "Não foi possível carregar CIOT." });
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    if (!ciotEnabled || !dataInicio) return;
    void carregar();
  }, [ciotEnabled, dataInicio, carregar]);

  if (featLoading) return <TableListSkeleton />;
  if (!ciotEnabled) {
    return <p className="p-6 text-sm text-gray-600">Módulo CIOT desabilitado.</p>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold">CIOT</h1>
        <Link href="/fiscal/ciot/nova" className="btn-primary text-sm">
          Registrar CIOT
        </Link>
      </div>
      <HomologacaoBanner ambiente="homologacao" />
      {provider === "nao_implementado" || provider === "ipef" ? (
        <div className="rounded border border-amber-200 bg-amber-50 text-amber-900 text-sm p-3">
          Integração IPEF/ANTT ainda não configurada. Operações reais retornam
          NAO_IMPLEMENTADO. Em testes/demo usa-se provider mock (sem validade).
        </div>
      ) : null}
      <div className="flex gap-2">
        <input type="date" className="input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        <input type="date" className="input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
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
                <th className="p-3">CIOT</th>
                <th className="p-3">Data</th>
                <th className="p-3">Transportador</th>
                <th className="p-3">Motorista</th>
                <th className="p-3">Veículo</th>
                <th className="p-3">Origem</th>
                <th className="p-3">Destino</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-3">
                    <Link className="text-blue-700 hover:underline" href={`/fiscal/ciot/${row.id}`}>
                      {row.codigoCiot || row.id}
                    </Link>
                  </td>
                  <td className="p-3">{row.dataOperacao ? formatDate(row.dataOperacao) : "—"}</td>
                  <td className="p-3">{row.transportadorNome || "—"}</td>
                  <td className="p-3">{row.motoristaNome || "—"}</td>
                  <td className="p-3">{row.veiculoPlaca || "—"}</td>
                  <td className="p-3">
                    {[row.origemMunicipio, row.origemUf].filter(Boolean).join("/") || "—"}
                  </td>
                  <td className="p-3">
                    {[row.destinoMunicipio, row.destinoUf].filter(Boolean).join("/") || "—"}
                  </td>
                  <td className="p-3">
                    {row.valorOperacao != null ? formatMoney(row.valorOperacao) : "—"}
                  </td>
                  <td className="p-3 capitalize">{row.status}</td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-500">
                    Nenhum CIOT no período.
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
