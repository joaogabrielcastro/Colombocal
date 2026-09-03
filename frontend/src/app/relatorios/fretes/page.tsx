"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { formatDate, formatMoney, localDateInputValue } from "@/lib/utils";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";
import { downloadCsvPtBr } from "@/lib/csv";
import FreteFeatureGuard from "@/components/FreteFeatureGuard";

type FreteLinha = {
  id: number;
  data: string;
  valor: number;
  reciboEmitido: boolean;
  reciboNumero: string | null;
  observacao: string | null;
  avulso: boolean;
  cliente: { id: number; razaoSocial: string; nomeFantasia: string | null } | null;
  venda: {
    id: number;
    numeroVenda: number | null;
    motorista: { id: number; nome: string; placa: string | null } | null;
  } | null;
};

type RelatorioFretes = {
  totalRegistros: number;
  totalValor: number;
  quantidadeComRecibo: number;
  totalComRecibo: number;
  quantidadeSemRecibo: number;
  totalSemRecibo: number;
  porCliente: { clienteId: number; nome: string; quantidade: number; total: number }[];
  fretes: FreteLinha[];
};

export default function RelatorioFretesPage() {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [cliente, setCliente] = useState("");
  const [avulso, setAvulso] = useState("");
  const [recibo, setRecibo] = useState("");
  const [data, setData] = useState<RelatorioFretes | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hoje = new Date();
    const ini = localDateInputValue(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    const fim = localDateInputValue(hoje);
    setDataInicio(ini);
    setDataFim(fim);
    void carregar(ini, fim, "", "", "");
  }, []);

  const carregar = async (
    ini = dataInicio,
    fim = dataFim,
    cli = cliente,
    av = avulso,
    rec = recibo,
  ) => {
    if (!ini || !fim) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ dataInicio: ini, dataFim: fim, take: "500" });
      if (cli.trim()) q.set("cliente", cli.trim());
      if (av) q.set("avulso", av);
      if (rec) q.set("reciboEmitido", rec);
      const r = await api.get<RelatorioFretes>(`/relatorios/fretes?${q}`);
      setData(r);
    } catch (e) {
      reportApiError(e, { title: "Não foi possível carregar o relatório de fretes" });
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = () => {
    if (!data?.fretes.length) return;
    downloadCsvPtBr(
      `relatorio-fretes-${dataInicio}-${dataFim}.csv`,
      ["Data", "Cliente", "Tipo", "Ordem", "Motorista", "Valor", "Recibo", "Nº recibo", "Observação"],
      data.fretes.map((f) => [
        formatDate(f.data),
        f.cliente?.nomeFantasia || f.cliente?.razaoSocial || "",
        f.avulso ? "Avulso" : "Venda",
        f.venda?.numeroVenda != null ? `#${f.venda.numeroVenda}` : "",
        f.venda?.motorista?.nome || "",
        f.valor,
        f.reciboEmitido ? "Sim" : "Não",
        f.reciboNumero || "",
        f.observacao || "",
      ]),
    );
  };

  return (
    <FreteFeatureGuard>
    <div className="p-4 sm:p-6 lg:px-8 w-full max-w-none">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Relatório de Fretes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Movimentos de frete no período — avulsos e vinculados a venda.
        </p>
      </div>

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cliente</label>
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void carregar()}
              className="input-field"
              placeholder="Nome ou documento"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <select
              value={avulso}
              onChange={(e) => setAvulso(e.target.value)}
              className="input-field"
            >
              <option value="">Todos</option>
              <option value="false">Com venda</option>
              <option value="true">Avulso</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Recibo</label>
            <select
              value={recibo}
              onChange={(e) => setRecibo(e.target.value)}
              className="input-field"
            >
              <option value="">Todos</option>
              <option value="true">Com recibo</option>
              <option value="false">Sem recibo</option>
            </select>
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
            disabled={!data?.fretes.length}
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="card p-4">
              <p className="text-xs text-gray-500">Movimentos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.totalRegistros}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500">Total frete</p>
              <p className="text-2xl font-bold text-green-700 mt-1">
                {formatMoney(data.totalValor)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500">Com recibo</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {data.quantidadeComRecibo}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{formatMoney(data.totalComRecibo)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500">Sem recibo</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {data.quantidadeSemRecibo}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{formatMoney(data.totalSemRecibo)}</p>
            </div>
          </div>

          {data.porCliente.length > 0 ? (
            <div className="card overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Por cliente</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="table-header">Cliente</th>
                    <th className="table-header text-right">Qtd</th>
                    <th className="table-header text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.porCliente.slice(0, 20).map((c) => (
                    <tr key={c.clienteId} className="table-row">
                      <td className="table-cell font-medium">{c.nome}</td>
                      <td className="table-cell text-right">{c.quantidade}</td>
                      <td className="table-cell text-right font-medium text-green-700">
                        {formatMoney(c.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Detalhes</h2>
            </div>
            {data.fretes.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">Nenhum frete no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="table-header">Data</th>
                      <th className="table-header">Cliente</th>
                      <th className="table-header">Tipo</th>
                      <th className="table-header">Ordem</th>
                      <th className="table-header text-right">Valor</th>
                      <th className="table-header">Recibo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.fretes.map((f) => (
                      <tr key={f.id} className="table-row">
                        <td className="table-cell whitespace-nowrap">{formatDate(f.data)}</td>
                        <td className="table-cell">
                          {f.cliente?.nomeFantasia || f.cliente?.razaoSocial || "—"}
                        </td>
                        <td className="table-cell">{f.avulso ? "Avulso" : "Venda"}</td>
                        <td className="table-cell">
                          {f.venda?.numeroVenda != null ? `#${f.venda.numeroVenda}` : "—"}
                        </td>
                        <td className="table-cell text-right font-medium text-green-700">
                          {formatMoney(f.valor)}
                        </td>
                        <td className="table-cell">
                          {f.reciboEmitido
                            ? f.reciboNumero
                              ? `Sim · ${f.reciboNumero}`
                              : "Sim"
                            : "Não"}
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
    </FreteFeatureGuard>
  );
}
