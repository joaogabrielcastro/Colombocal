"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { formatMoney, localDateInputValue } from "@/lib/utils";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";
import { downloadCsvPtBr } from "@/lib/csv";

type MotoristaLinha = {
  id: number;
  nome: string;
  placa: string | null;
  veiculo: string | null;
  ativo: boolean;
  vendas: { quantidade: number; valorProdutos: number; frete: number };
  carregamentos: { quantidade: number; totalItens: number };
};

type RelatorioMotoristas = {
  totalMotoristas: number;
  totais: {
    vendas: number;
    valorProdutos: number;
    frete: number;
    carregamentos: number;
    itensCarregamento: number;
  };
  motoristas: MotoristaLinha[];
};

export default function RelatorioMotoristasPage() {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [data, setData] = useState<RelatorioMotoristas | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hoje = new Date();
    const ini = localDateInputValue(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    const fim = localDateInputValue(hoje);
    setDataInicio(ini);
    setDataFim(fim);
    void carregar(ini, fim);
  }, []);

  const carregar = async (ini = dataInicio, fim = dataFim) => {
    if (!ini || !fim) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ dataInicio: ini, dataFim: fim });
      const r = await api.get<RelatorioMotoristas>(`/relatorios/motoristas?${q}`);
      setData(r);
    } catch (e) {
      reportApiError(e, {
        title: "Não foi possível carregar o relatório de motoristas",
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = () => {
    if (!data?.motoristas.length) return;
    downloadCsvPtBr(
      `relatorio-motoristas-${dataInicio}-${dataFim}.csv`,
      ["Motorista", "Placa", "Veículo", "Vendas", "Valor produtos", "Frete", "OCs", "Itens OC"],
      data.motoristas.map((m) => [
        m.nome,
        m.placa || "",
        m.veiculo || "",
        m.vendas.quantidade,
        m.vendas.valorProdutos,
        m.vendas.frete,
        m.carregamentos.quantidade,
        m.carregamentos.totalItens,
      ]),
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:px-8 w-full max-w-none">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Relatório de Motoristas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Desempenho no período: vendas com motorista e ordens de carregamento.
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
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" className="btn-primary" onClick={() => void carregar()}>
              <MagnifyingGlassIcon className="w-4 h-4" />
              Aplicar
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!data?.motoristas.length}
              onClick={exportarCSV}
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-4">
          <TableListSkeleton rows={8} cols={6} />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="card p-4">
              <p className="text-xs text-gray-500">Motoristas com movimento</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.totalMotoristas}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500">Vendas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.totais.vendas}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatMoney(data.totais.valorProdutos)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500">Frete (nas vendas)</p>
              <p className="text-2xl font-bold text-green-700 mt-1">
                {formatMoney(data.totais.frete)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500">Carregamentos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {data.totais.carregamentos}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {data.totais.itensCarregamento.toLocaleString("pt-BR")} itens
              </p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Por motorista</h2>
            </div>
            {data.motoristas.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">
                Nenhum motorista com vendas ou OC no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="table-header">Motorista</th>
                      <th className="table-header">Placa</th>
                      <th className="table-header text-right">Vendas</th>
                      <th className="table-header text-right">Produtos</th>
                      <th className="table-header text-right">Frete</th>
                      <th className="table-header text-right">OCs</th>
                      <th className="table-header text-right">Itens OC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.motoristas.map((m) => (
                      <tr key={m.id} className="table-row">
                        <td className="table-cell font-medium">
                          {m.nome}
                          {!m.ativo ? (
                            <span className="ml-2 text-xs text-gray-400">inativo</span>
                          ) : null}
                        </td>
                        <td className="table-cell">{m.placa || "—"}</td>
                        <td className="table-cell text-right">{m.vendas.quantidade}</td>
                        <td className="table-cell text-right">
                          {formatMoney(m.vendas.valorProdutos)}
                        </td>
                        <td className="table-cell text-right text-green-700 font-medium">
                          {formatMoney(m.vendas.frete)}
                        </td>
                        <td className="table-cell text-right">
                          {m.carregamentos.quantidade}
                        </td>
                        <td className="table-cell text-right">
                          {m.carregamentos.totalItens.toLocaleString("pt-BR")}
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
