"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import {
  formatMoney,
  formatDate,
  STATUS_CHEQUE_LABEL,
  STATUS_CHEQUE_COLOR,
  type Cheque,
  type StatusCheque,
} from "@/lib/utils";
import api from "@/lib/api";
import * as XLSX from "xlsx";

// a_receber → recebido → depositado
const STATUS_NEXT: Record<string, string[]> = {
  a_receber: ["recebido"],
  recebido: ["depositado", "a_receber"],
  depositado: [],
};

export default function ChequesPage() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [atualizando, setAtualizando] = useState<number | null>(null);

  const carregar = () => {
    const params = new URLSearchParams();
    if (statusFiltro) params.set("status", statusFiltro);
    if (dataInicio) params.set("dataInicio", dataInicio);
    if (dataFim) params.set("dataFim", dataFim);
    setLoading(true);
    api
      .get<Cheque[]>(`/cheques?${params}`)
      .then(setCheques)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleMudarStatus = async (id: number, novoStatus: string) => {
    setAtualizando(id);
    try {
      await api.patch(`/cheques/${id}/status`, { status: novoStatus });
      carregar();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAtualizando(null);
    }
  };

  const getExportRows = () =>
    cheques.map((c) => ({
      ordem: c.numeroOrdem,
      cliente: c.cliente.nomeFantasia || c.cliente.razaoSocial,
      banco: c.banco || "",
      numeroCheque: c.numero || "",
      venda: c.venda ? `Venda #${c.venda.id}` : "-",
      valor: parseFloat(String(c.valor)),
      dataRecebimento: formatDate(c.dataRecebimento),
      status: STATUS_CHEQUE_LABEL[c.status],
    }));

  const handleExportExcel = () => {
    const rows = getExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cheques");
    XLSX.writeFile(wb, `cheques_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rowsHtml = cheques
      .map(
        (c) => `
      <tr>
        <td>#${c.numeroOrdem}</td>
        <td>${c.cliente.nomeFantasia || c.cliente.razaoSocial}</td>
        <td>${c.banco || "-"}${c.numero ? ` / Nº ${c.numero}` : ""}</td>
        <td>${c.venda ? `Venda #${c.venda.id}` : "-"}</td>
        <td>${formatMoney(c.valor)}</td>
        <td>${formatDate(c.dataRecebimento)}</td>
        <td>${STATUS_CHEQUE_LABEL[c.status]}</td>
      </tr>
    `,
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Cheques</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 8px; font-size: 20px; }
            p { margin: 0 0 16px; color: #4b5563; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Relatório de Cheques</h1>
          <p>Gerado em ${new Date().toLocaleString("pt-BR")}</p>
          <table>
            <thead>
              <tr>
                <th>Ordem</th>
                <th>Cliente</th>
                <th>Banco / Nº</th>
                <th>Venda</th>
                <th>Valor</th>
                <th>Recebido em</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const totalPendente = cheques
    .filter((c) => c.status === "a_receber" || c.status === "recebido")
    .reduce((acc, c) => acc + parseFloat(String(c.valor)), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cheques</h1>
          <p className="text-gray-500 text-sm mt-1">
            {cheques.length} cheques
            {totalPendente > 0 && ` • Pendente: ${formatMoney(totalPendente)}`}
          </p>
        </div>
        <Link href="/cheques/novo" className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Novo Cheque
        </Link>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="input-field w-40"
            >
              <option value="">Todos</option>
              <option value="a_receber">A Receber</option>
              <option value="recebido">Recebido</option>
              <option value="depositado">Depositado</option>
            </select>
          </div>
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
          <div className="flex items-end">
            <button onClick={carregar} className="btn-primary">
              <MagnifyingGlassIcon className="w-4 h-4" /> Filtrar
            </button>
          </div>
          <div className="flex items-end gap-2 ml-auto">
            <button onClick={handleExportPdf} className="btn-secondary">
              Exportar PDF
            </button>
            <button onClick={handleExportExcel} className="btn-secondary">
              Exportar Excel
            </button>
          </div>
        </div>
      </div>

      {/* Resumo por status */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(["a_receber", "recebido", "depositado"] as StatusCheque[]).map(
          (s) => {
            const grupo = cheques.filter((c) => c.status === s);
            const total = grupo.reduce(
              (acc, c) => acc + parseFloat(String(c.valor)),
              0,
            );
            return (
              <div
                key={s}
                className={`card p-3 text-center cursor-pointer border-2 ${statusFiltro === s ? "border-blue-500" : "border-transparent"}`}
                onClick={() => {
                  setStatusFiltro(statusFiltro === s ? "" : s);
                  setTimeout(carregar, 50);
                }}
              >
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CHEQUE_COLOR[s]}`}
                >
                  {STATUS_CHEQUE_LABEL[s]}
                </span>
                <p className="font-bold text-gray-900 mt-1">{grupo.length}</p>
                <p className="text-xs text-gray-500">{formatMoney(total)}</p>
              </div>
            );
          },
        )}
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : cheques.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Nenhum cheque encontrado
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header w-16">Ordem</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Banco / Nº</th>
                <th className="table-header">Venda</th>
                <th className="table-header">Valor</th>
                <th className="table-header">Recebido em</th>
                <th className="table-header">Status</th>
                <th className="table-header">Ações</th>
              </tr>
            </thead>
            <tbody>
              {cheques.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="table-cell font-mono text-sm font-bold text-gray-600">
                    #{c.numeroOrdem}
                  </td>
                  <td className="table-cell">
                    <Link
                      href={`/clientes/${c.clienteId}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {c.cliente.nomeFantasia || c.cliente.razaoSocial}
                    </Link>
                  </td>
                  <td className="table-cell">
                    <p className="font-medium">{c.banco || "-"}</p>
                    {c.numero && (
                      <p className="text-xs text-gray-400">Nº {c.numero}</p>
                    )}
                  </td>
                  <td className="table-cell">
                    {c.venda ? (
                      <Link
                        href={`/vendas/${c.venda.id}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Venda #{c.venda.id}
                      </Link>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="table-cell font-semibold">
                    {formatMoney(c.valor)}
                  </td>
                  <td className="table-cell">
                    {formatDate(c.dataRecebimento)}
                  </td>
                  <td className="table-cell">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_CHEQUE_COLOR[c.status]}`}
                    >
                      {STATUS_CHEQUE_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {STATUS_NEXT[c.status]?.map((next) => (
                        <button
                          key={next}
                          disabled={atualizando === c.id}
                          onClick={() => handleMudarStatus(c.id, next)}
                          className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                            next === "a_receber"
                              ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                          }`}
                        >
                          → {STATUS_CHEQUE_LABEL[next as StatusCheque]}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
