"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { formatDate, localDateInputValue } from "@/lib/utils";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";
import { downloadCsvPtBr } from "@/lib/csv";

type OcLinha = {
  id: number;
  numeroOc: number;
  dataEmissao: string;
  pedido: string | null;
  clienteNome: string;
  clienteCidade: string | null;
  clienteUf: string | null;
  motoristaNome: string | null;
  motoristaPlaca: string | null;
  vendaId: number | null;
  totalItens: number;
  itens: { descricao: string; quantidade: number; unidade: string }[];
};

type RelatorioOc = {
  totalRegistros: number;
  totalQuantidade: number;
  porCliente: { nome: string; quantidade: number; totalItens: number }[];
  porMotorista: {
    motoristaId: number | null;
    nome: string;
    quantidade: number;
    totalItens: number;
  }[];
  ordens: OcLinha[];
};

export default function RelatorioCarregamentoPage() {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [cliente, setCliente] = useState("");
  const [data, setData] = useState<RelatorioOc | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hoje = new Date();
    const ini = localDateInputValue(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    const fim = localDateInputValue(hoje);
    setDataInicio(ini);
    setDataFim(fim);
    void carregar(ini, fim, "");
  }, []);

  const carregar = async (ini = dataInicio, fim = dataFim, cli = cliente) => {
    if (!ini || !fim) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ dataInicio: ini, dataFim: fim, take: "500" });
      if (cli.trim()) q.set("cliente", cli.trim());
      const r = await api.get<RelatorioOc>(`/relatorios/carregamento?${q}`);
      setData(r);
    } catch (e) {
      reportApiError(e, {
        title: "Não foi possível carregar o relatório de carregamento",
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = () => {
    if (!data?.ordens.length) return;
    downloadCsvPtBr(
      `relatorio-carregamento-${dataInicio}-${dataFim}.csv`,
      ["OC", "Data", "Cliente", "Cidade", "UF", "Motorista", "Placa", "Pedido", "Qtd itens", "Itens"],
      data.ordens.map((o) => [
        o.numeroOc,
        formatDate(o.dataEmissao),
        o.clienteNome || "",
        o.clienteCidade || "",
        o.clienteUf || "",
        o.motoristaNome || "",
        o.motoristaPlaca || "",
        o.pedido || "",
        o.totalItens,
        o.itens.map((i) => `${i.descricao} ${i.quantidade} ${i.unidade}`).join(" | "),
      ]),
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:px-8 w-full max-w-none">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Relatório de Carregamento</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ordens de carregamento do pátio no período (sem valor financeiro).
        </p>
      </div>

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Cliente</label>
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void carregar()}
              className="input-field"
              placeholder="Nome do cliente na OC"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => void carregar()}>
            <MagnifyingGlassIcon className="w-4 h-4" />
            Aplicar
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!data?.ordens.length}
            onClick={exportarCSV}
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-4">
          <TableListSkeleton rows={8} cols={6} />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="card p-4">
              <p className="text-xs text-gray-500">Ordens</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.totalRegistros}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500">Quantidade total (itens)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {data.totalQuantidade.toLocaleString("pt-BR")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Por motorista</h2>
              </div>
              {data.porMotorista.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Sem dados.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="table-header">Motorista</th>
                      <th className="table-header text-right">OCs</th>
                      <th className="table-header text-right">Itens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.porMotorista.slice(0, 15).map((m, idx) => (
                      <tr key={`${m.motoristaId ?? "n"}-${idx}`} className="table-row">
                        <td className="table-cell font-medium">{m.nome}</td>
                        <td className="table-cell text-right">{m.quantidade}</td>
                        <td className="table-cell text-right">
                          {m.totalItens.toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Por cliente</h2>
              </div>
              {data.porCliente.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Sem dados.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="table-header">Cliente</th>
                      <th className="table-header text-right">OCs</th>
                      <th className="table-header text-right">Itens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.porCliente.slice(0, 15).map((c) => (
                      <tr key={c.nome} className="table-row">
                        <td className="table-cell font-medium">{c.nome}</td>
                        <td className="table-cell text-right">{c.quantidade}</td>
                        <td className="table-cell text-right">
                          {c.totalItens.toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Detalhes</h2>
            </div>
            {data.ordens.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">Nenhuma OC no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="table-header">OC</th>
                      <th className="table-header">Data</th>
                      <th className="table-header">Cliente</th>
                      <th className="table-header">Motorista</th>
                      <th className="table-header text-right">Itens</th>
                      <th className="table-header"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ordens.map((o) => (
                      <tr key={o.id} className="table-row">
                        <td className="table-cell font-medium">#{o.numeroOc}</td>
                        <td className="table-cell whitespace-nowrap">
                          {formatDate(o.dataEmissao)}
                        </td>
                        <td className="table-cell">
                          <p className="font-medium">{o.clienteNome}</p>
                          {(o.clienteCidade || o.clienteUf) && (
                            <p className="text-xs text-gray-400">
                              {[o.clienteCidade, o.clienteUf].filter(Boolean).join(" / ")}
                            </p>
                          )}
                        </td>
                        <td className="table-cell">
                          {o.motoristaNome || "—"}
                          {o.motoristaPlaca ? (
                            <span className="text-xs text-gray-400"> · {o.motoristaPlaca}</span>
                          ) : null}
                        </td>
                        <td className="table-cell text-right">
                          {o.totalItens.toLocaleString("pt-BR")}
                        </td>
                        <td className="table-cell text-right">
                          <Link
                            href={`/carregamento/${o.id}/editar`}
                            className="text-blue-600 hover:underline text-xs font-medium"
                          >
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
