"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ListPageSkeleton, TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";

// Fluxo com devolução: a_receber -> recebido -> depositado, com desvios para devolvido
const STATUS_NEXT: Record<StatusCheque, StatusCheque[]> = {
  a_receber: ["recebido", "devolvido"],
  recebido: ["depositado", "a_receber", "devolvido"],
  depositado: ["devolvido"],
  devolvido: ["recebido", "a_receber"],
};

type ResumoStatus = { status: string; count: number; total: number };

function ChequesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [resumoPorStatus, setResumoPorStatus] = useState<ResumoStatus[] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => parseInt(searchParams.get("page") || "1", 10) || 1);
  const [statusFiltro, setStatusFiltro] = useState(searchParams.get("status") || "");
  const [dataInicio, setDataInicio] = useState(searchParams.get("dataInicio") || "");
  const [dataFim, setDataFim] = useState(searchParams.get("dataFim") || "");
  const ordemInicial = searchParams.get("ordem") || "";
  const [ordemInput, setOrdemInput] = useState(ordemInicial);
  const [ordemFiltro, setOrdemFiltro] = useState(ordemInicial);
  const [atualizando, setAtualizando] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const carregar = async () => {
    const params = new URLSearchParams();
    if (statusFiltro) params.set("status", statusFiltro);
    if (dataInicio) params.set("dataInicio", dataInicio);
    if (dataFim) params.set("dataFim", dataFim);
    const ordemTrim = ordemFiltro.replace(/^#/, "").trim();
    if (ordemTrim) params.set("ordem", ordemTrim);
    params.set("resumo", "1");
    params.set("take", String(pageSize));
    params.set("skip", String((page - 1) * pageSize));
    setLoading(true);
    try {
      const resp = await api.getWithMeta<
        Cheque[] | { items: Cheque[]; resumoPorStatus: ResumoStatus[] }
      >(`/cheques?${params.toString()}`);
      const raw = resp.data;
      if (Array.isArray(raw)) {
        setCheques(raw);
        setResumoPorStatus(null);
      } else {
        setCheques(raw.items);
        setResumoPorStatus(raw.resumoPorStatus);
      }
      setTotal(resp.meta.totalCount ?? (Array.isArray(raw) ? raw.length : raw.items.length));
    } catch (e) {
      reportApiError(e, {
        title: "Não foi possível carregar os cheques",
        onRetry: () => void carregar(),
      });
      setCheques([]);
      setResumoPorStatus(null);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFiltro) params.set("status", statusFiltro);
    if (dataInicio) params.set("dataInicio", dataInicio);
    if (dataFim) params.set("dataFim", dataFim);
    const ordemTrim = ordemFiltro.replace(/^#/, "").trim();
    if (ordemTrim) params.set("ordem", ordemTrim);
    if (page > 1) params.set("page", String(page));
    router.replace(`/cheques${params.toString() ? `?${params.toString()}` : ""}`);
    carregar();
  }, [statusFiltro, dataInicio, dataFim, ordemFiltro, page]);

  const CONFIRM_RECEBIDO_DEPOSITADO = "AGORA_TODOS_RECEBIDO_PARA_DEPOSITADO";

  /** Só altera cheques em Recebido no momento da chamada; não muda cadastro futuro. */
  const bulkMarcarRecebidoDepositadoAgora = async () => {
    if (
      !window.confirm(
        'Ação única e manual: todos os cheques que estão em "Recebido" AGORA passam para "Depositado" (com data de compensação).\n\nNovos cheques seguem o fluxo normal (A receber → Recebido → Depositado).\n\nContinuar?',
      )
    ) {
      return;
    }
    const digitado = window.prompt(
      `Para confirmar, digite exatamente:\n${CONFIRM_RECEBIDO_DEPOSITADO}`,
    );
    if (digitado !== CONFIRM_RECEBIDO_DEPOSITADO) {
      setFeedback("Operação cancelada.");
      return;
    }
    setBulkLoading(true);
    setFeedback("");
    try {
      const r = await api.post<{
        atualizados: number;
        candidatos: number;
        recebidoRestantes: number;
        errosTotal: number;
      }>("/cheques/bulk-marcar-recebido-depositado-agora", {
        confirmacao: CONFIRM_RECEBIDO_DEPOSITADO,
      });
      setFeedback(
        `Concluído: ${r.atualizados} de ${r.candidatos} cheques atualizados. Restam ${r.recebidoRestantes} em "Recebido".${r.errosTotal > 0 ? ` Erros: ${r.errosTotal}.` : ""}`,
      );
      await carregar();
    } catch (e) {
      reportApiError(e, { title: "Não foi possível executar a ação em massa" });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleMudarStatus = async (id: number, novoStatus: string) => {
    setAtualizando(id);
    setFeedback("");
    try {
      await api.patch(`/cheques/${id}/status`, { status: novoStatus });
      setFeedback("Status atualizado com sucesso.");
      await carregar();
    } catch (e) {
      reportApiError(e, { title: "Não foi possível atualizar o status" });
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
      dataCompensacao: formatDate(c.dataCompensacao),
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
        <td>${formatDate(c.dataCompensacao)}</td>
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
                <th>Compensado em</th>
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

  const resumoMap = new Map(
    (resumoPorStatus ?? []).map((r) => [r.status, r]),
  );
  const totalPendente =
    (resumoMap.get("a_receber")?.total ?? 0) +
    (resumoMap.get("recebido")?.total ?? 0);
  const totalPendenteFallback = cheques
    .filter((c) => c.status === "a_receber" || c.status === "recebido")
    .reduce((acc, c) => acc + parseFloat(String(c.valor)), 0);
  const pendenteExibido =
    resumoPorStatus != null ? totalPendente : totalPendenteFallback;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cheques</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} cheque{total === 1 ? "" : "s"} com os filtros atuais
            {pendenteExibido > 0 &&
              ` • Pendente (a receber + recebido): ${formatMoney(pendenteExibido)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            disabled={bulkLoading}
            onClick={() => void bulkMarcarRecebidoDepositadoAgora()}
            className="btn-secondary text-sm text-green-900 border-green-200 bg-green-50 hover:bg-green-100 disabled:opacity-50"
            title="Só os cheques em Recebido neste momento"
          >
            Recebido → Depositado (agora)
          </button>
          <Link href="/cheques/novo" className="btn-primary">
            <PlusIcon className="w-4 h-4" /> Novo Cheque
          </Link>
        </div>
      </div>
      {feedback && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">{feedback}</div>}

      {/* Filtros: aplicar ordem/venda só ao clicar Filtrar; exportações separadas */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={statusFiltro}
              onChange={(e) => {
                setStatusFiltro(e.target.value);
                setPage(1);
              }}
              className="input-field w-40"
            >
              <option value="">Todos</option>
              <option value="a_receber">A Receber</option>
              <option value="recebido">Recebido</option>
              <option value="depositado">Depositado</option>
              <option value="devolvido">Devolvido</option>
            </select>
          </div>
          <div className="min-w-[10.5rem]">
            <label className="block text-xs text-gray-500 mb-1">
              Ordem / venda
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={ordemInput}
              onChange={(e) => setOrdemInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setOrdemFiltro(ordemInput.replace(/^#/, "").trim());
                  setPage(1);
                }
              }}
              className="input-field font-mono"
              placeholder="ex: 1520 ou #1520"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Nº ordem do cheque ou ID da venda
            </p>
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
          <button
            type="button"
            onClick={() => {
              setOrdemFiltro(ordemInput.replace(/^#/, "").trim());
              setPage(1);
            }}
            className="btn-primary h-10 shrink-0"
          >
            <MagnifyingGlassIcon className="w-4 h-4 inline -mt-0.5 mr-1" />
            Filtrar
          </button>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={handleExportPdf} className="btn-secondary">
            Exportar PDF
          </button>
          <button type="button" onClick={handleExportExcel} className="btn-secondary">
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Resumo por status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {(["a_receber", "recebido", "depositado", "devolvido"] as StatusCheque[]).map(
          (s) => {
            const fromResumo = resumoMap.get(s);
            const grupo = cheques.filter((c) => c.status === s);
            const count =
              fromResumo?.count ??
              (resumoPorStatus == null ? grupo.length : 0);
            const valorTotal =
              fromResumo?.total ??
              (resumoPorStatus == null
                ? grupo.reduce(
                    (acc, c) => acc + parseFloat(String(c.valor)),
                    0,
                  )
                : 0);
            return (
              <div
                key={s}
                className={`card p-3 text-center cursor-pointer border-2 ${statusFiltro === s ? "border-blue-500" : "border-transparent"}`}
                onClick={() => {
                  setStatusFiltro(statusFiltro === s ? "" : s);
                  setPage(1);
                }}
              >
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CHEQUE_COLOR[s]}`}
                >
                  {STATUS_CHEQUE_LABEL[s]}
                </span>
                <p className="font-bold text-gray-900 mt-1">{count}</p>
                <p className="text-xs text-gray-500">{formatMoney(valorTotal)}</p>
              </div>
            );
          },
        )}
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableListSkeleton rows={12} cols={8} />
          </div>
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
                <th className="table-header">Compensado em</th>
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
                  <td className="table-cell">{formatDate(c.dataCompensacao)}</td>
                  <td className="table-cell">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_CHEQUE_COLOR[c.status]}`}
                    >
                      {STATUS_CHEQUE_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {STATUS_NEXT[c.status].map((next) => (
                        <button
                          key={next}
                          disabled={atualizando === c.id}
                          onClick={() => handleMudarStatus(c.id, next)}
                          className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                            next === "a_receber"
                              ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                              : next === "devolvido"
                                ? "bg-red-100 text-red-700 hover:bg-red-200"
                              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                          }`}
                        >
                          → {STATUS_CHEQUE_LABEL[next]}
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
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <p>Total de registros: {total}</p>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <span>Página {page} de {totalPages}</span>
          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChequesPage() {
  return (
    <Suspense fallback={<ListPageSkeleton tableRows={12} />}>
      <ChequesPageContent />
    </Suspense>
  );
}
