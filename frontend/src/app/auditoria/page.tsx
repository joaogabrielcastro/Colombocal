"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/utils";
import api from "@/lib/api";
import { ListScaffold } from "@/components/ui/list-scaffold";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";
import { localDateInputValue } from "@/lib/utils";
import { labelTipoAuditoria } from "@/lib/auditoria-labels";

type AuditoriaEvento = {
  id: number;
  tipo: string;
  entidade: string;
  entidadeId: number | null;
  userLabel: string | null;
  usuario?: string | null;
  tipoLabel?: string | null;
  valor: string | number | null;
  vendaId: number | null;
  clienteId: number | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

type TipoFiltro = { key: string; label: string };

export default function AuditoriaPage() {
  const hoje = localDateInputValue();
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [tipo, setTipo] = useState("");
  const [eventos, setEventos] = useState<AuditoriaEvento[]>([]);
  const [tipos, setTipos] = useState<TipoFiltro[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const p = new URLSearchParams({ take: "100" });
      if (dataInicio) p.set("dataInicio", dataInicio);
      if (dataFim) p.set("dataFim", dataFim);
      if (tipo) p.set("tipo", tipo);
      const list = await api.get<AuditoriaEvento[]>(`/auditoria?${p}`);
      setEventos(list);
    } catch (e) {
      reportApiError(e, { title: "Auditoria" });
      setErro(e instanceof Error ? e.message : "Erro ao carregar");
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, tipo]);

  useEffect(() => {
    api
      .get<TipoFiltro[]>("/auditoria/tipos")
      .then(setTipos)
      .catch(() => setTipos([]));
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <ListScaffold
      title="Auditoria"
      subtitle="Histórico de ações no sistema (vendas, pagamentos, cheques, permissões…)"
      actions={
        <button type="button" className="btn-primary" onClick={() => void carregar()}>
          Atualizar
        </button>
      }
      content={
        <div className="space-y-4">
          <div className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">De</label>
              <input
                type="date"
                className="input-field w-full"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Até</label>
              <input
                type="date"
                className="input-field w-full"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select
                className="input-field w-full"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                <option value="">Todos</option>
                {tipos.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {erro ? (
            <p className="text-sm text-red-600 px-1">{erro}</p>
          ) : null}

          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-4">
                <TableListSkeleton rows={8} cols={5} />
              </div>
            ) : eventos.length === 0 ? (
              <p className="p-6 text-sm text-gray-500 text-center">
                Nenhum evento no período.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="table-header">Data/hora</th>
                    <th className="table-header">Usuário</th>
                    <th className="table-header">Ação</th>
                    <th className="table-header">Entidade</th>
                    <th className="table-header text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.map((ev) => (
                    <tr key={ev.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="table-cell whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="table-cell">{ev.usuario ?? ev.userLabel ?? "—"}</td>
                      <td className="table-cell">
                        <span className="font-medium text-gray-900">
                          {ev.tipoLabel ?? labelTipoAuditoria(ev.tipo)}
                        </span>
                      </td>
                      <td className="table-cell">
                        {ev.entidade}
                        {ev.entidadeId != null ? ` #${ev.entidadeId}` : ""}
                        {ev.vendaId != null && ev.entidade !== "Venda" ? (
                          <Link
                            href={`/vendas/${ev.vendaId}`}
                            className="text-blue-600 hover:underline ml-1"
                          >
                            (venda)
                          </Link>
                        ) : null}
                        {ev.entidade === "Venda" && ev.entidadeId != null ? (
                          <Link
                            href={`/vendas/${ev.entidadeId}`}
                            className="text-blue-600 hover:underline ml-1"
                          >
                            abrir
                          </Link>
                        ) : null}
                      </td>
                      <td className="table-cell text-right">
                        {ev.valor != null ? formatMoney(ev.valor) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      }
    />
  );
}
