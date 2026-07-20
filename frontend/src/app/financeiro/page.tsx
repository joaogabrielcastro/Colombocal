"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import {
  formatMoney,
  formatDate,
  type Cheque,
  type Pagamento,
} from "@/lib/utils";
import { VendaOrdem, vendaOrdemTexto } from "@/components/VendaOrdem";
import * as XLSX from "xlsx";
import { ListPageSkeleton, TableListSkeleton } from "@/components/ui/skeletons";
import { ExportActions } from "@/components/ui/export-actions";
import { FilterBar } from "@/components/ui/filter-bar";
import { ListScaffold } from "@/components/ui/list-scaffold";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useChequesQuery } from "@/features/cheques/hooks/useChequesQuery";
import { usePagamentosQuery } from "@/features/financeiro/hooks/usePagamentosQuery";
import api from "@/lib/api";
import { reportApiError } from "@/lib/report-api-error";
import { toast } from "sonner";

type AbaFinanceiro = "recebimentos" | "cheques";

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
  const [aba, setAba] = useState<AbaFinanceiro>(
    () => (searchParams.get("aba") === "cheques" ? "cheques" : "recebimentos"),
  );
  const [page, setPage] = useState(() => parseInt(searchParams.get("page") || "1", 10) || 1);
  const [dataInicio, setDataInicio] = useState(searchParams.get("dataInicio") || "");
  const [dataFim, setDataFim] = useState(searchParams.get("dataFim") || "");
  const [clienteInput, setClienteInput] = useState(searchParams.get("cliente") || "");
  const [clienteFiltro, setClienteFiltro] = useState(searchParams.get("cliente") || "");
  const [emitenteInput, setEmitenteInput] = useState(searchParams.get("emitente") || "");
  const [emitenteFiltro, setEmitenteFiltro] = useState(searchParams.get("emitente") || "");
  const [bancoInput, setBancoInput] = useState(searchParams.get("banco") || "");
  const [bancoFiltro, setBancoFiltro] = useState(searchParams.get("banco") || "");
  const [numeroInput, setNumeroInput] = useState(searchParams.get("numero") || "");
  const [numeroFiltro, setNumeroFiltro] = useState(searchParams.get("numero") || "");
  const [valorMinInput, setValorMinInput] = useState(searchParams.get("valorMin") || "");
  const [valorMinFiltro, setValorMinFiltro] = useState(searchParams.get("valorMin") || "");
  const [valorMaxInput, setValorMaxInput] = useState(searchParams.get("valorMax") || "");
  const [valorMaxFiltro, setValorMaxFiltro] = useState(searchParams.get("valorMax") || "");
  const ordemInicial = searchParams.get("ordem") || "";
  const [ordemInput, setOrdemInput] = useState(ordemInicial);
  const [ordemFiltro, setOrdemFiltro] = useState(ordemInicial);
  const [tipoFiltro, setTipoFiltro] = useState(searchParams.get("tipo") || "");
  const [chequeParaEstornar, setChequeParaEstornar] = useState<Cheque | null>(null);
  const [pagamentoParaEstornar, setPagamentoParaEstornar] = useState<Pagamento | null>(null);
  const [estornando, setEstornando] = useState(false);
  const [maisFiltros, setMaisFiltros] = useState(false);
  const chequesQuery = useChequesQuery({
    dataInicio,
    dataFim,
    cliente: clienteFiltro,
    emitente: emitenteFiltro,
    banco: bancoFiltro,
    numero: numeroFiltro,
    valorMin: valorMinFiltro,
    valorMax: valorMaxFiltro,
    ordem: ordemFiltro,
    page,
    pageSize,
  });
  const pagamentosQuery = usePagamentosQuery({
    dataInicio,
    dataFim,
    cliente: clienteFiltro,
    ordem: ordemFiltro,
    tipo: tipoFiltro,
    page,
    pageSize,
  });
  const cheques = chequesQuery.data?.cheques ?? [];
  const pagamentos = pagamentosQuery.data?.pagamentos ?? [];
  const loading = aba === "cheques" ? chequesQuery.isLoading : pagamentosQuery.isLoading;
  const resumo =
    aba === "cheques" ? chequesQuery.data?.resumo ?? null : pagamentosQuery.data?.resumo ?? null;
  const total =
    aba === "cheques" ? chequesQuery.data?.total ?? 0 : pagamentosQuery.data?.total ?? 0;
  const aplicarFiltros = () => {
    setOrdemFiltro(ordemInput.replace(/^#/, "").trim());
    setClienteFiltro(clienteInput.trim());
    setEmitenteFiltro(emitenteInput.trim());
    setBancoFiltro(bancoInput.trim());
    setNumeroFiltro(numeroInput.trim());
    setValorMinFiltro(valorMinInput.trim());
    setValorMaxFiltro(valorMaxInput.trim());
    setPage(1);
  };

  useEffect(() => {
    const di = searchParams.get("dataInicio") || "";
    const df = searchParams.get("dataFim") || "";
    const cliente = searchParams.get("cliente") || "";
    const emitente = searchParams.get("emitente") || "";
    const banco = searchParams.get("banco") || "";
    const numero = searchParams.get("numero") || "";
    const valorMin = searchParams.get("valorMin") || "";
    let valorMax = searchParams.get("valorMax") || "";
    if (valorMax.trim() !== "") {
      const n = Number(valorMax.replace(",", "."));
      if (!Number.isNaN(n) && n <= 0) valorMax = "";
    }
    const ordem = searchParams.get("ordem") || "";
    const parsedPage = parseInt(searchParams.get("page") || "1", 10) || 1;
    setDataInicio(di);
    setDataFim(df);
    setClienteInput(cliente);
    setClienteFiltro(cliente);
    setEmitenteInput(emitente);
    setEmitenteFiltro(emitente);
    setBancoInput(banco);
    setBancoFiltro(banco);
    setNumeroInput(numero);
    setNumeroFiltro(numero);
    setValorMinInput(valorMin);
    setValorMinFiltro(valorMin);
    setValorMaxInput(valorMax);
    setValorMaxFiltro(valorMax);
    setOrdemInput(ordem);
    setOrdemFiltro(ordem);
    setPage(parsedPage);
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dataInicio) params.set("dataInicio", dataInicio);
    if (dataFim) params.set("dataFim", dataFim);
    if (clienteFiltro) params.set("cliente", clienteFiltro);
    if (emitenteFiltro) params.set("emitente", emitenteFiltro);
    if (bancoFiltro) params.set("banco", bancoFiltro);
    if (numeroFiltro) params.set("numero", numeroFiltro);
    if (valorMinFiltro) params.set("valorMin", valorMinFiltro);
    const vmaxTrim = valorMaxFiltro.trim();
    if (vmaxTrim !== "") {
      const n = Number(vmaxTrim.replace(",", "."));
      if (!Number.isNaN(n) && n > 0) params.set("valorMax", vmaxTrim);
    }
    const ordemTrim = ordemFiltro.replace(/^#/, "").trim();
    if (ordemTrim) params.set("ordem", ordemTrim);
    if (aba === "recebimentos" && tipoFiltro) params.set("tipo", tipoFiltro);
    if (aba === "cheques") params.set("aba", "cheques");
    if (page > 1) params.set("page", String(page));
    router.replace(`/financeiro${params.toString() ? `?${params.toString()}` : ""}`);
  }, [
    dataInicio,
    dataFim,
    clienteFiltro,
    emitenteFiltro,
    bancoFiltro,
    numeroFiltro,
    valorMinFiltro,
    valorMaxFiltro,
    ordemFiltro,
    tipoFiltro,
    aba,
    page,
  ]);

  const getExportRows = () =>
    cheques.map((c) => ({
      ordem: c.numeroOrdem,
      cliente: c.cliente.nomeFantasia || c.cliente.razaoSocial,
      banco: c.banco || "",
      numeroCheque: c.numero || "",
      venda: c.venda ? `Venda ${vendaOrdemTexto(c.venda)}` : "-",
      valor: parseFloat(String(c.valor)),
      emitente: c.emitenteNome || "",
      preDatado: formatDate(c.dataRecebimento),
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
        <td>${c.venda ? `Venda ${vendaOrdemTexto(c.venda)}` : "-"}</td>
        <td>${formatMoney(c.valor)}</td>
        <td>${formatDate(c.dataRecebimento)}</td>
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
    if (chequeParaEstornar) {
      setEstornando(true);
      try {
        await api.delete(`/cheques/${chequeParaEstornar.id}`);
        toast.success(`Cheque #${chequeParaEstornar.numeroOrdem} estornado`);
        setChequeParaEstornar(null);
        await queryClient.invalidateQueries({ queryKey: ["cheques"] });
        await queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      } catch (e) {
        reportApiError(e, { title: "Não foi possível estornar o cheque" });
      } finally {
        setEstornando(false);
      }
      return;
    }
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

  const subtitle =
    aba === "recebimentos"
      ? "Todos os recebimentos (cheque, PIX e dinheiro) com a ordem vinculada"
      : "Histórico detalhado de cheques";

  return (
    <>
    <ListScaffold
      title="Financeiro"
      subtitle={subtitle}
      actions={(
        <Link href="/financeiro/novo" className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Receber pagamento
        </Link>
      )}
      filters={(
        <FilterBar className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
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
                  aplicarFiltros();
                }
              }}
              className="input-field font-mono w-full"
              placeholder="ex: 1520 ou #1520"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Data início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="input-field w-full"
            />
          </div>
        </div>
        {maisFiltros ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 items-end pt-1 border-t border-gray-100">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Emitente</label>
            <input
              type="text"
              value={emitenteInput}
              onChange={(e) => setEmitenteInput(e.target.value)}
              className="input-field w-full"
              placeholder="Nome do emitente"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Banco</label>
            <input
              type="text"
              value={bancoInput}
              onChange={(e) => setBancoInput(e.target.value)}
              className="input-field w-full"
              placeholder="Ex.: Bradesco"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nº cheque</label>
            <input
              type="text"
              value={numeroInput}
              onChange={(e) => setNumeroInput(e.target.value)}
              className="input-field w-full"
              placeholder="Ex.: 003579"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Valor mínimo
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorMinInput}
              onChange={(e) => setValorMinInput(e.target.value)}
              className="input-field w-full"
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Valor máximo
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorMaxInput}
              onChange={(e) => setValorMaxInput(e.target.value)}
              className="input-field w-full"
              placeholder="0,00"
            />
          </div>
        </div>
        ) : null}
        <div className="pt-1 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              aplicarFiltros();
            }}
            className="btn-primary h-10 shrink-0"
          >
            <MagnifyingGlassIcon className="w-4 h-4 inline -mt-0.5 mr-1" />
            Filtrar
          </button>
          <button
            type="button"
            onClick={() => {
              setDataInicio("");
              setDataFim("");
              setOrdemInput("");
              setOrdemFiltro("");
              setClienteInput("");
              setClienteFiltro("");
              setEmitenteInput("");
              setEmitenteFiltro("");
              setBancoInput("");
              setBancoFiltro("");
              setNumeroInput("");
              setNumeroFiltro("");
              setValorMinInput("");
              setValorMinFiltro("");
              setValorMaxInput("");
              setValorMaxFiltro("");
              setPage(1);
            }}
            className="btn-secondary h-10 shrink-0"
          >
            Limpar
          </button>
          <button
            type="button"
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
            onClick={() => setMaisFiltros((v) => !v)}
          >
            {maisFiltros ? "Ocultar filtros" : "Mais filtros"}
          </button>
          <div className="ml-auto">
            <ExportActions onExportPdf={handleExportPdf} onExportExcel={handleExportExcel} />
          </div>
        </div>
        </FilterBar>
      )}
      content={(
        <>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
              aba === "recebimentos"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => {
              setAba("recebimentos");
              setPage(1);
            }}
          >
            Todos os recebimentos
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
              aba === "cheques"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => {
              setAba("cheques");
              setPage(1);
            }}
          >
            Só cheques
          </button>
        </div>
        {!loading && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="text-slate-600">
              Resultado dos filtros:{" "}
              {total > 0 ? (
                <span className="font-semibold text-slate-900">
                  {total} {aba === "cheques" ? "cheque" : "recebimento"}
                  {total === 1 ? "" : "s"}
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
            <TableListSkeleton rows={12} cols={8} />
          </div>
        ) : aba === "recebimentos" ? (
          pagamentos.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p className="font-medium text-gray-600">Nenhum recebimento encontrado</p>
              <p className="text-sm mt-1">
                {clienteFiltro || ordemFiltro || dataInicio || dataFim
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
                          ? `#${p.cheque.numeroOrdem}${p.cheque.banco ? ` · ${p.cheque.banco}` : ""}${
                              p.cheque.numero ? ` · nº ${p.cheque.numero}` : ""
                            }`
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
          )
        ) : cheques.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Nenhum cheque encontrado
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header w-16">Cheque</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Banco / Nº</th>
                <th className="table-header">Emitente</th>
                <th className="table-header w-28 bg-slate-50">Venda</th>
                <th className="table-header">Valor</th>
                <th className="table-header">Data</th>
                <th className="table-header w-36">Ações</th>
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
                    {c.emitenteNome || "-"}
                  </td>
                  <td className="table-cell">
                    {c.venda ? (
                      <VendaOrdem venda={c.venda} size="sm" prefix="Venda" />
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
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      {c.venda ? (
                        <>
                          <Link
                            href={`/vendas/${c.venda.id}`}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            Ver venda
                          </Link>
                          <span className="text-gray-300">·</span>
                          <Link
                            href={`/financeiro/novo?clienteId=${c.clienteId}&vendaId=${c.venda.id}&ordem=${c.venda.numeroVenda ?? c.venda.id}`}
                            className="text-green-700 hover:underline"
                          >
                            Receber
                          </Link>
                          <span className="text-gray-300">·</span>
                        </>
                      ) : null}
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                        disabled={estornando}
                        onClick={() => setChequeParaEstornar(c)}
                      >
                        Estornar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
        </>
      )}
      footer={(
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
      )}
    />
    <ConfirmDialog
      open={chequeParaEstornar != null || pagamentoParaEstornar != null}
      title="Estornar recebimento?"
      description={
        chequeParaEstornar
          ? `Cheque #${chequeParaEstornar.numeroOrdem} · ${formatMoney(chequeParaEstornar.valor)}${
              chequeParaEstornar.venda
                ? ` · ${vendaOrdemTexto(chequeParaEstornar.venda)}`
                : ""
            }\n\nO valor volta para o saldo em aberto da venda.`
          : pagamentoParaEstornar
            ? `${labelTipoPagamento(pagamentoParaEstornar.tipo)} · ${formatMoney(pagamentoParaEstornar.valor)}${
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
        if (!estornando) {
          setChequeParaEstornar(null);
          setPagamentoParaEstornar(null);
        }
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
