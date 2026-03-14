"use client";
import { useEffect, useState } from "react";
import {
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { formatMoney, formatDate } from "@/lib/utils";
import api from "@/lib/api";

interface ContaCliente {
  cliente: { id: number; razaoSocial: string; nomeFantasia?: string };
  saldo: number;
  debito: number;
  credito: number;
}

interface ChequeStatus {
  status: string;
  count: number;
  total: number;
}

interface ChequeItem {
  id: number;
  cliente: { nomeFantasia?: string; razaoSocial: string };
  valor: number;
  banco: string;
  numero: string;
  dataCompensacao: string;
  status: string;
}

interface FinanceiroData {
  clientesDevedores: ContaCliente[];
  totalEmAberto: number;
  chequesPorStatus: ChequeStatus[];
  chequesPendentes: ChequeItem[];
  chequesDevolvidos: ChequeItem[];
}

const STATUS_LABEL: Record<string, string> = {
  recebido: "Recebido",
  depositado: "Depositado",
  compensado: "Compensado",
  devolvido: "Devolvido",
};

const STATUS_COLOR: Record<string, string> = {
  recebido: "bg-blue-100 text-blue-800",
  depositado: "bg-yellow-100 text-yellow-800",
  compensado: "bg-green-100 text-green-800",
  devolvido: "bg-red-100 text-red-800",
};

export default function FinanceiroPage() {
  const [dados, setDados] = useState<FinanceiroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"devedores" | "pendentes" | "devolvidos">(
    "devedores",
  );

  useEffect(() => {
    api
      .get<FinanceiroData>("/relatorios/financeiro")
      .then(setDados)
      .finally(() => setLoading(false));
  }, []);

  const exportarCSV = () => {
    if (!dados) return;
    let csv = "";
    if (aba === "devedores") {
      csv =
        "Cliente,Débitos,Créditos,Saldo\n" +
        dados.clientesDevedores
          .map(
            (c) =>
              `${(c.cliente.nomeFantasia || c.cliente.razaoSocial).replace(/[,;"]/g, " ")},${c.debito.toFixed(2)},${c.credito.toFixed(2)},${c.saldo.toFixed(2)}`,
          )
          .join("\n");
    } else {
      const lista =
        aba === "pendentes" ? dados.chequesPendentes : dados.chequesDevolvidos;
      csv =
        "Cliente,Banco,Número,Vencimento,Valor,Status\n" +
        lista
          .map((c) =>
            [
              (c.cliente.nomeFantasia || c.cliente.razaoSocial).replace(
                /[,;"]/g,
                " ",
              ),
              c.banco.replace(/[,;"]/g, " "),
              c.numero,
              formatDate(c.dataCompensacao),
              parseFloat(String(c.valor)).toFixed(2),
              c.status,
            ].join(","),
          )
          .join("\n");
    }
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${aba}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Relatório Financeiro
        </h1>
        {dados && (
          <button
            onClick={exportarCSV}
            className="btn-secondary flex items-center gap-1"
          >
            <ArrowDownTrayIcon className="w-4 h-4" /> Exportar CSV
          </button>
        )}
      </div>

      {loading && (
        <div className="text-center text-gray-400 py-8">Carregando...</div>
      )}

      {!loading && dados && (
        <>
          {/* Cards topo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500">Total em Aberto</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatMoney(dados.totalEmAberto)}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500">Clientes Devendo</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {dados.clientesDevedores.length}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500">Cheques Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">
                {dados.chequesPendentes.length}
              </p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500">Cheques Devolvidos</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {dados.chequesDevolvidos.length}
              </p>
            </div>
          </div>

          {/* Status cheques */}
          {dados.chequesPorStatus.length > 0 && (
            <div className="card p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Cheques por Status
              </h3>
              <div className="flex gap-3 flex-wrap">
                {dados.chequesPorStatus.map((s) => (
                  <div
                    key={s.status}
                    className={`px-3 py-2 rounded-lg text-sm ${STATUS_COLOR[s.status] || "bg-gray-100 text-gray-700"}`}
                  >
                    <span className="font-medium">
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                    <span className="mx-1">·</span>
                    <span>{s.count}</span>
                    <span className="mx-1">·</span>
                    <span>{formatMoney(s.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Abas */}
          <div className="flex gap-1 mb-4 border-b border-gray-200">
            {(
              [
                {
                  key: "devedores",
                  label: `Clientes Devedores (${dados.clientesDevedores.length})`,
                },
                {
                  key: "pendentes",
                  label: `Cheques Pendentes (${dados.chequesPendentes.length})`,
                },
                {
                  key: "devolvidos",
                  label: `Cheques Devolvidos (${dados.chequesDevolvidos.length})`,
                },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setAba(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${aba === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {aba === "devedores" && (
            <div className="card overflow-hidden">
              {dados.clientesDevedores.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  Nenhum cliente com saldo devedor.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Cliente</th>
                      <th className="table-header text-right">Total Débitos</th>
                      <th className="table-header text-right">
                        Total Créditos
                      </th>
                      <th className="table-header text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.clientesDevedores
                      .sort((a, b) => a.saldo - b.saldo)
                      .map((c) => (
                        <tr key={c.cliente.id} className="table-row">
                          <td className="table-cell">
                            <div className="flex items-center gap-2">
                              <ExclamationTriangleIcon className="w-4 h-4 text-red-400 shrink-0" />
                              <a
                                href={`/clientes/${c.cliente.id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {c.cliente.nomeFantasia ||
                                  c.cliente.razaoSocial}
                              </a>
                            </div>
                          </td>
                          <td className="table-cell text-right">
                            {formatMoney(c.debito)}
                          </td>
                          <td className="table-cell text-right">
                            {formatMoney(c.credito)}
                          </td>
                          <td className="table-cell text-right font-bold text-red-600">
                            {formatMoney(c.saldo)}
                          </td>
                        </tr>
                      ))}
                    <tr className="bg-gray-50 font-bold">
                      <td className="table-cell" colSpan={3}>
                        Total em Aberto
                      </td>
                      <td className="table-cell text-right text-red-600">
                        {formatMoney(dados.totalEmAberto)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}

          {aba === "pendentes" && (
            <div className="card overflow-hidden">
              {dados.chequesPendentes.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  Nenhum cheque pendente.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Cliente</th>
                      <th className="table-header">Banco</th>
                      <th className="table-header">Número</th>
                      <th className="table-header">Previsão Comp.</th>
                      <th className="table-header">Status</th>
                      <th className="table-header text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.chequesPendentes.map((c) => (
                      <tr key={c.id} className="table-row">
                        <td className="table-cell">
                          {c.cliente.nomeFantasia || c.cliente.razaoSocial}
                        </td>
                        <td className="table-cell">{c.banco}</td>
                        <td className="table-cell">{c.numero}</td>
                        <td className="table-cell">
                          {c.dataCompensacao
                            ? formatDate(c.dataCompensacao)
                            : "—"}
                        </td>
                        <td className="table-cell">
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLOR[c.status]}`}
                          >
                            {STATUS_LABEL[c.status]}
                          </span>
                        </td>
                        <td className="table-cell text-right font-semibold">
                          {formatMoney(c.valor)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold">
                      <td className="table-cell" colSpan={5}>
                        Total
                      </td>
                      <td className="table-cell text-right">
                        {formatMoney(
                          dados.chequesPendentes.reduce(
                            (s, c) => s + parseFloat(String(c.valor)),
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}

          {aba === "devolvidos" && (
            <div className="card overflow-hidden">
              {dados.chequesDevolvidos.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  Nenhum cheque devolvido.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Cliente</th>
                      <th className="table-header">Banco</th>
                      <th className="table-header">Número</th>
                      <th className="table-header">Data Receb.</th>
                      <th className="table-header text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.chequesDevolvidos.map((c) => (
                      <tr key={c.id} className="table-row">
                        <td className="table-cell">
                          <a
                            href={`/clientes/${c.cliente}`}
                            className="text-blue-600 hover:underline"
                          >
                            {c.cliente.nomeFantasia || c.cliente.razaoSocial}
                          </a>
                        </td>
                        <td className="table-cell">{c.banco}</td>
                        <td className="table-cell">{c.numero}</td>
                        <td className="table-cell">
                          {formatDate(c.dataCompensacao)}
                        </td>
                        <td className="table-cell text-right font-semibold text-red-600">
                          {formatMoney(c.valor)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold">
                      <td className="table-cell" colSpan={4}>
                        Total Devolvido
                      </td>
                      <td className="table-cell text-right text-red-600">
                        {formatMoney(
                          dados.chequesDevolvidos.reduce(
                            (s, c) => s + parseFloat(String(c.valor)),
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
