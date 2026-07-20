"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { formatMoney, formatDate, type Pagamento } from "@/lib/utils";
import { VendaOrdem, vendaOrdemTexto } from "@/components/VendaOrdem";
import * as XLSX from "xlsx";
import { ListPageSkeleton, TableListSkeleton } from "@/components/ui/skeletons";
import { ExportActions } from "@/components/ui/export-actions";
import { FilterBar } from "@/components/ui/filter-bar";
import { ListScaffold } from "@/components/ui/list-scaffold";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePagamentosQuery } from "@/features/financeiro/hooks/usePagamentosQuery";
import api from "@/lib/api";
import { reportApiError } from "@/lib/report-api-error";
import { toast } from "sonner";

function labelTipoPagamento(tipo: string) {
  const t = tipo.toLowerCase();
  if (t === "dinheiro") return "Dinheiro";
  if (t === "transferencia") return "PIX";
  if (t === "cheque") return "Cheque";
  if (t.startsWith("troco_dinheiro")) return "Troco (dinheiro)";
  if (t.startsWith("troco_transferencia")) return "Troco (PIX)";
  return tipo;
}

function FinanceiroPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pageSize = 20;
  const [page, setPage] = useState(() => parseInt(searchParams.get("page") || "1", 10) || 1);
  const [dataInicio, setDataInicio] = useState(searchParams.get("dataInicio") || "");
  const [dataFim, setDataFim] = useState(searchParams.get("dataFim") || "");
  const [clienteInput, setClienteInput] = useState(searchParams.get("cliente") || "");
  const [clienteFiltro, setClienteFiltro] = useState(searchParams.get("cliente") || "");
  const ordemInicial = searchParams.get("ordem") || "";
  const [ordemInput, setOrdemInput] = useState(ordemInicial);
  const [ordemFiltro, setOrdemFiltro] = useState(ordemInicial);
  const [tipoFiltro, setTipoFiltro] = useState(searchParams.get("tipo") || "");
  const [pagamentoParaEstornar, setPagamentoParaEstornar] = useState<Pagamento | null>(null);
  const [estornando, setEstornando] = useState(false);

  const pagamentosQuery = usePagamentosQuery({
    dataInicio,
    dataFim,
    cliente: clienteFiltro,
    ordem: ordemFiltro,
    tipo: tipoFiltro,
    page,
    pageSize,
  });
  const pagamentos = pagamentosQuery.data?.pagamentos ?? [];
  const loading = pagamentosQuery.isLoading;
  const resumo = pagamentosQuery.data?.resumo ?? null;
  const total = pagamentosQuery.data?.total ?? 0;

  const aplicarFiltros = () => {
    setOrdemFiltro(ordemInput.replace(/^#/, "").trim());
    setClienteFiltro(clienteInput.trim());
    setPage(1);
  };

  const limparFiltros = () => {
    setDataInicio("");
    setDataFim("");
    setOrdemInput("");
    setOrdemFiltro("");
    setClienteInput("");
    setClienteFiltro("");
    setTipoFiltro("");
    setPage(1);
  };

  useEffect(() => {
    const di = searchParams.get("dataInicio") || "";
    const df = searchParams.get("dataFim") || "";
    const cliente = searchParams.get("cliente") || "";
    const ordem = searchParams.get("ordem") || "";
    const tipo = searchParams.get("tipo") || "";
    const parsedPage = parseInt(searchParams.get("page") || "1", 10) || 1;
    setDataInicio(di);
    setDataFim(df);
    setClienteInput(cliente);
    setClienteFiltro(cliente);
    setOrdemInput(ordem);
    setOrdemFiltro(ordem);
    setTipoFiltro(tipo);
    setPage(parsedPage);
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dataInicio) params.set("dataInicio", dataInicio);
    if (dataFim) params.set("dataFim", dataFim);
    if (clienteFiltro) params.set("cliente", clienteFiltro);
    const ordemTrim = ordemFiltro.replace(/^#/, "").trim();
    if (ordemTrim) params.set("ordem", ordemTrim);
    if (tipoFiltro) params.set("tipo", tipoFiltro);
    if (page > 1) params.set("page", String(page));
    router.replace(`/financeiro${params.toString() ? `?${params.toString()}` : ""}`);
  }, [dataInicio, dataFim, clienteFiltro, ordemFiltro, tipoFiltro, page, router]);

  const handleExportExcel = () => {
    const rows = pagamentos.map((p) => ({
      tipo: labelTipoPagamento(p.tipo),
      cliente: p.cliente?.nomeFantasia || p.cliente?.razaoSocial || "",
      venda: p.venda ? `Venda ${vendaOrdemTexto(p.venda)}` : "",
      detalhe:
        String(p.tipo).toLowerCase() === "cheque" && p.cheque
          ? `#${p.cheque.numeroOrdem}${p.cheque.banco ? ` · ${p.cheque.banco}` : ""}${
              p.cheque.numero ? ` · nº ${p.cheque.numero}` : ""
            }`
          : p.observacoes || "",
      valor: parseFloat(String(p.valor)),
      data: formatDate(p.data),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recebimentos");
    XLSX.writeFile(wb, `financeiro_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rowsHtml = pagamentos
      .map(
        (p) => `
      <tr>
        <td>${labelTipoPagamento(p.tipo)}</td>
        <td>${p.cliente?.nomeFantasia || p.cliente?.razaoSocial || "-"}</td>
        <td>${p.venda ? `Venda ${vendaOrdemTexto(p.venda)}` : "-"}</td>
        <td>${formatMoney(p.valor)}</td>
        <td>${formatDate(p.data)}</td>
      </tr>
    `,
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório Financeiro</title>
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
          <h1>Recebimentos</h1>
          <p>Gerado em ${new Date().toLocaleString("pt-BR")}</p>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Venda</th>
                <th>Valor</th>
                <th>Data</th>
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

  const totalValorFiltrado = resumo?.total != null ? resumo.total : null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const confirmarEstorno = async () => {
    if (!pagamentoParaEstornar) return;
    setEstornando(true);
    try {
      const isCheque =
        String(pagamentoParaEstornar.tipo).toLowerCase() === "cheque" &&
        (pagamentoParaEstornar.chequeId || pagamentoParaEstornar.cheque?.id);
      if (isCheque) {
        const chequeId = Number(
          pagamentoParaEstornar.chequeId ?? pagamentoParaEstornar.cheque?.id,
        );
        await api.delete(`/cheques/${chequeId}`);
        toast.success("Cheque estornado");
      } else {
        await api.delete(`/pagamentos/${pagamentoParaEstornar.id}`);
        toast.success(
          `${labelTipoPagamento(pagamentoParaEstornar.tipo)} estornado`,
        );
      }
      setPagamentoParaEstornar(null);
      await queryClient.invalidateQueries({ queryKey: ["cheques"] });
      await queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
    } catch (e) {
      reportApiError(e, { title: "Não foi possível estornar o recebimento" });
    } finally {
      setEstornando(false);
    }
  };

  return (
    <>
      <ListScaffold
        title="Financeiro"
        subtitle="Cheque, PIX e dinheiro — com a ordem vinculada. O tipo aparece em cada linha."
        actions={
          <Link href="/financeiro/novo" className="btn-primary">
            <PlusIcon className="w-4 h-4" /> Receber pagamento
          </Link>
        }
        filters={
          <FilterBar className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cliente</label>
                <input
                  type="text"
                  value={clienteInput}
                  onChange={(e) => setClienteInput(e.target.value)}
                  className="input-field w-full"
                  placeholder="Nome fantasia, razão ou CNPJ"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ordem / venda</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={ordemInput}
                  onChange={(e) => setOrdemInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") aplicarFiltros();
                  }}
                  className="input-field font-mono w-full"
                  placeholder="ex: 1520 ou #1520"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value);
                    setPage(1);
                  }}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value);
                    setPage(1);
                  }}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                <select
                  value={tipoFiltro}
                  onChange={(e) => {
                    setTipoFiltro(e.target.value);
                    setPage(1);
                  }}
                  className="input-field w-full"
                >
                  <option value="">Todos</option>
                  <option value="cheque">Cheque</option>
                  <option value="transferencia">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>
            </div>
            <div className="pt-1 border-t border-gray-100 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={aplicarFiltros}
                className="btn-primary h-10 shrink-0"
              >
                <MagnifyingGlassIcon className="w-4 h-4 inline -mt-0.5 mr-1" />
                Filtrar
              </button>
              <button
                type="button"
                onClick={limparFiltros}
                className="btn-secondary h-10 shrink-0"
              >
                Limpar
              </button>
              <div className="ml-auto">
                <ExportActions
                  onExportPdf={handleExportPdf}
                  onExportExcel={handleExportExcel}
                />
              </div>
            </div>
          </FilterBar>
        }
        content={
          <>
            {!loading && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p className="text-slate-600">
                  Resultado dos filtros:{" "}
                  {total > 0 ? (
                    <span className="font-semibold text-slate-900">
                      {total} recebimento{total === 1 ? "" : "s"}
                      {totalValorFiltrado != null
                        ? ` · ${formatMoney(totalValorFiltrado)}`
                        : ""}
                    </span>
                  ) : (
                    <span className="text-slate-400">nenhum registro</span>
                  )}
                </p>
              </div>
            )}
            <div className="card overflow-hidden">
              {loading ? (
                <div className="p-4">
                  <TableListSkeleton rows={12} cols={7} />
                </div>
              ) : pagamentos.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p className="font-medium text-gray-600">
                    Nenhum recebimento encontrado
                  </p>
                  <p className="text-sm mt-1">
                    {clienteFiltro || ordemFiltro || dataInicio || dataFim || tipoFiltro
                      ? "Nenhum resultado para estes filtros. Tente limpar os filtros."
                      : "Ainda não há recebimentos. Clique em Receber pagamento para registrar o primeiro."}
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="table-header w-24">Tipo</th>
                      <th className="table-header">Cliente</th>
                      <th className="table-header w-28 bg-slate-50">Venda</th>
                      <th className="table-header">Detalhe</th>
                      <th className="table-header">Valor</th>
                      <th className="table-header">Data</th>
                      <th className="table-header w-36">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagamentos.map((p) => {
                      const tipo = String(p.tipo || "").toLowerCase();
                      const isCheque = tipo === "cheque";
                      return (
                        <tr key={p.id} className="table-row">
                          <td className="table-cell">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                isCheque
                                  ? "bg-violet-100 text-violet-800"
                                  : tipo === "dinheiro"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : tipo === "transferencia"
                                      ? "bg-sky-100 text-sky-800"
                                      : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {labelTipoPagamento(p.tipo)}
                            </span>
                          </td>
                          <td className="table-cell">
                            {p.cliente ? (
                              <Link
                                href={`/clientes/${p.clienteId}`}
                                className="font-medium text-blue-600 hover:underline"
                              >
                                {p.cliente.nomeFantasia || p.cliente.razaoSocial}
                              </Link>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="table-cell">
                            {p.venda ? (
                              <VendaOrdem venda={p.venda} size="sm" prefix="Venda" />
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="table-cell text-sm text-gray-600">
                            {isCheque && p.cheque
                              ? `#${p.cheque.numeroOrdem}${
                                  p.cheque.banco ? ` · ${p.cheque.banco}` : ""
                                }${p.cheque.numero ? ` · nº ${p.cheque.numero}` : ""}`
                              : p.observacoes || "-"}
                          </td>
                          <td className="table-cell font-semibold">
                            {formatMoney(p.valor)}
                          </td>
                          <td className="table-cell">{formatDate(p.data)}</td>
                          <td className="table-cell">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                              {p.venda ? (
                                <>
                                  <Link
                                    href={`/vendas/${p.venda.id}`}
                                    className="text-blue-600 hover:underline font-medium"
                                  >
                                    Ver venda
                                  </Link>
                                  <span className="text-gray-300">·</span>
                                </>
                              ) : null}
                              <button
                                type="button"
                                className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                                disabled={estornando}
                                onClick={() => setPagamentoParaEstornar(p)}
                              >
                                Estornar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        }
        footer={
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <p>
              {total > 0
                ? `${total} registro${total === 1 ? "" : "s"}${
                    totalValorFiltrado != null && totalValorFiltrado > 0
                      ? ` · ${formatMoney(totalValorFiltrado)}`
                      : ""
                  }`
                : "Nenhum registro nos filtros"}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        }
      />
      <ConfirmDialog
        open={pagamentoParaEstornar != null}
        title="Estornar recebimento?"
        description={
          pagamentoParaEstornar
            ? `${labelTipoPagamento(pagamentoParaEstornar.tipo)} · ${formatMoney(
                pagamentoParaEstornar.valor,
              )}${
                pagamentoParaEstornar.venda
                  ? ` · ${vendaOrdemTexto(pagamentoParaEstornar.venda)}`
                  : ""
              }\n\nO valor volta para o saldo em aberto da venda.`
            : undefined
        }
        confirmText={estornando ? "Estornando…" : "Estornar"}
        cancelText="Cancelar"
        tone="danger"
        busy={estornando}
        onConfirm={() => void confirmarEstorno()}
        onCancel={() => {
          if (!estornando) setPagamentoParaEstornar(null);
        }}
      />
    </>
  );
}

export default function FinanceiroPage() {
  return (
    <Suspense fallback={<ListPageSkeleton tableRows={12} />}>
      <FinanceiroPageContent />
    </Suspense>
  );
}
