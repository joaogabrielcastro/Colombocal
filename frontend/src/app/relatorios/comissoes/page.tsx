"use client";
import { useEffect, useState } from "react";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import { formatMoney, formatDate } from "@/lib/utils";
import api from "@/lib/api";
import { TableListSkeleton } from "@/components/ui/skeletons";

interface VendaComissaoLinha {
  id: number;
  valorTotal: unknown;
  comissaoCalculada?: number;
  [key: string]: unknown;
}

interface ComissaoVendedor {
  vendedor: { id: number; nome: string; comissaoPercentual: number };
  vendas: VendaComissaoLinha[];
  totalVendas: number;
  comissao: number;
  percentual: number;
  quantidadeVendas: number;
}

type ComissaoModo = "emissao" | "caixa";

export default function ComissoesPage() {
  const [dados, setDados] = useState<ComissaoVendedor[]>([]);
  const [modo, setModo] = useState<ComissaoModo>("emissao");
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [expandido, setExpandido] = useState<number | null>(null);

  useEffect(() => {
    const hoje = new Date();
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const fim = hoje.toISOString().split("T")[0];
    setDataInicio(ini);
    setDataFim(fim);
    let cancelled = false;
    (async () => {
      let m: ComissaoModo = "emissao";
      try {
        const c = await api.get<{ comissaoModo: ComissaoModo }>("/config");
        m = c.comissaoModo === "caixa" ? "caixa" : "emissao";
        if (!cancelled) setModo(m);
      } catch {
        /* default emissao */
      }
      if (cancelled) return;
      const params = new URLSearchParams();
      params.set("dataInicio", ini);
      params.set("dataFim", fim);
      params.set("modo", m);
      setLoading(true);
      try {
        const r = await api.get<{
          modo: ComissaoModo;
          resultado: ComissaoVendedor[];
        }>(`/relatorios/comissoes?${params}`);
        if (!cancelled) {
          setModo(r.modo);
          setDados(r.resultado);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const exportarCSV = () => {
    if (!dados.length) return;
    const header = "Vendedor,Qtd Vendas,Total Vendas,Comissão %,Comissão R$\n";
    const rows = dados
      .map((d) =>
        [
          d.vendedor.nome.replace(/[,;"]/g, " "),
          d.quantidadeVendas,
          d.totalVendas.toFixed(2),
          d.percentual.toFixed(2),
          d.comissao.toFixed(2),
        ].join(","),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comissoes-${dataInicio}-${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buscar = (ini?: string, fim?: string, m?: ComissaoModo) => {
    const params = new URLSearchParams();
    if (ini ?? dataInicio) params.set("dataInicio", ini ?? dataInicio);
    if (fim ?? dataFim) params.set("dataFim", fim ?? dataFim);
    const modoUse = m ?? modo;
    params.set("modo", modoUse);
    setLoading(true);
    api
      .get<{ modo: ComissaoModo; resultado: ComissaoVendedor[] }>(
        `/relatorios/comissoes?${params}`,
      )
      .then((r) => {
        setModo(r.modo);
        setDados(r.resultado);
      })
      .finally(() => setLoading(false));
  };

  const salvarModoPadrao = async () => {
    await api.put("/config", { comissaoModo: modo });
    buscar();
  };

  const totalComissao = dados.reduce((acc, d) => acc + d.comissao, 0);
  const totalVendas = dados.reduce((acc, d) => acc + d.totalVendas, 0);

  const imprimirRelatorio = () => {
    const tituloAnterior = document.title;
    document.title = `Comissões por Vendedor - ${dataInicio} a ${dataFim}`;
    window.print();
    document.title = tituloAnterior;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Comissões por Vendedor
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Modo atual:{" "}
          <strong>{modo === "caixa" ? "sobre caixa (pago na ordem)" : "emissão (valor na venda)"}</strong>
        </p>
      </div>

      <div className="card p-4 mb-6">
        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Regra</label>
            <select
              value={modo}
              onChange={(e) => {
                const m = e.target.value as ComissaoModo;
                setModo(m);
                buscar(undefined, undefined, m);
              }}
              className="input-field min-w-44"
            >
              <option value="emissao">Emissão (histórico na venda)</option>
              <option value="caixa">Caixa (proporcional ao recebido)</option>
            </select>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <button onClick={() => buscar()} className="btn-primary">
              <MagnifyingGlassIcon className="w-4 h-4" /> Calcular
            </button>
            <button type="button" onClick={salvarModoPadrao} className="btn-secondary text-sm">
              Salvar regra padrão
            </button>
            {dados.length > 0 && (
              <>
                <button
                  onClick={imprimirRelatorio}
                  className="btn-secondary flex items-center gap-1"
                >
                  <PrinterIcon className="w-4 h-4" /> Imprimir
                </button>
                <button
                  onClick={exportarCSV}
                  className="btn-secondary flex items-center gap-1"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" /> Exportar CSV
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="card p-4">
          <TableListSkeleton rows={8} cols={5} />
        </div>
      )}

      {!loading && dados.length > 0 && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Total em Vendas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatMoney(totalVendas)}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Total em Comissões</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {formatMoney(totalComissao)}
              </p>
            </div>
          </div>

          {/* Por vendedor */}
          {dados.map((d) => (
            <div key={d.vendedor.id} className="card mb-3 overflow-hidden">
              <button
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                onClick={() =>
                  setExpandido(
                    expandido === d.vendedor.id ? null : d.vendedor.id,
                  )
                }
              >
                <div className="flex items-center gap-4">
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">
                      {d.vendedor.nome}
                    </p>
                    <p className="text-xs text-gray-400">
                      {d.quantidadeVendas} vendas • comissão:{" "}
                      {d.percentual.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Vendas</p>
                    <p className="font-semibold">
                      {formatMoney(d.totalVendas)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Comissão</p>
                    <p className="font-bold text-orange-600">
                      {formatMoney(d.comissao)}
                    </p>
                  </div>
                </div>
              </button>
              {expandido === d.vendedor.id && d.vendas.length > 0 && (
                <div className="border-t border-gray-100">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="table-header">#</th>
                        <th className="table-header">Data</th>
                        <th className="table-header">Cliente</th>
                        <th className="table-header text-right">Total</th>
                        <th className="table-header text-right">Comissão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.vendas.map((v: any) => (
                        <tr key={v.id} className="table-row bg-gray-50">
                          <td className="table-cell text-gray-400">#{v.id}</td>
                          <td className="table-cell">
                            {formatDate(v.dataVenda)}
                          </td>
                          <td className="table-cell">
                            {v.cliente.nomeFantasia || v.cliente.razaoSocial}
                          </td>
                          <td className="table-cell text-right">
                            {formatMoney(v.valorTotal)}
                          </td>
                          <td className="table-cell text-right text-orange-600">
                            {formatMoney(
                              v.comissaoCalculada ??
                                (parseFloat(String(v.valorTotal)) *
                                  d.percentual) /
                                  100,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
