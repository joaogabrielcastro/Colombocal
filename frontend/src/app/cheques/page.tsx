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
} from "@/lib/utils";
import api from "@/lib/api";
import * as XLSX from "xlsx";
import { ListPageSkeleton, TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";

type ResumoStatus = { status: string; count: number; total: number };

function ChequesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [resumoPorStatus, setResumoPorStatus] = useState<ResumoStatus[] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => parseInt(searchParams.get("page") || "1", 10) || 1);
  const [dataInicio, setDataInicio] = useState(searchParams.get("dataInicio") || "");
  const [dataFim, setDataFim] = useState(searchParams.get("dataFim") || "");
  const [clienteInput, setClienteInput] = useState(searchParams.get("cliente") || "");
  const [clienteFiltro, setClienteFiltro] = useState(searchParams.get("cliente") || "");
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
  const aplicarFiltros = () => {
    setOrdemFiltro(ordemInput.replace(/^#/, "").trim());
    setClienteFiltro(clienteInput.trim());
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

  const carregar = async () => {
    const params = new URLSearchParams();
    if (dataInicio) params.set("dataInicio", dataInicio);
    if (dataFim) params.set("dataFim", dataFim);
    if (clienteFiltro) params.set("cliente", clienteFiltro);
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
    if (dataInicio) params.set("dataInicio", dataInicio);
    if (dataFim) params.set("dataFim", dataFim);
    if (clienteFiltro) params.set("cliente", clienteFiltro);
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
    if (page > 1) params.set("page", String(page));
    router.replace(`/cheques${params.toString() ? `?${params.toString()}` : ""}`);
    carregar();
  }, [
    dataInicio,
    dataFim,
    clienteFiltro,
    bancoFiltro,
    numeroFiltro,
    valorMinFiltro,
    valorMaxFiltro,
    ordemFiltro,
    page,
  ]);

  const getExportRows = () =>
    cheques.map((c) => ({
      ordem: c.numeroOrdem,
      cliente: c.cliente.nomeFantasia || c.cliente.razaoSocial,
      banco: c.banco || "",
      numeroCheque: c.numero || "",
      venda: c.venda ? `Venda #${c.venda.id}` : "-",
      valor: parseFloat(String(c.valor)),
      emitente: c.emitenteNome || "",
      preDatado: formatDate(c.dataRecebimento),
      dataCompensacao: formatDate(c.dataCompensacao),
      status: STATUS_CHEQUE_LABEL[c.status as keyof typeof STATUS_CHEQUE_LABEL] || "Ativo",
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
        <td>${STATUS_CHEQUE_LABEL[c.status as keyof typeof STATUS_CHEQUE_LABEL] || "Ativo"}</td>
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
                <th>Pré-datado</th>
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
  const totalExibido = resumoMap.get("ativo")?.total ?? cheques.reduce((acc, c) => acc + parseFloat(String(c.valor)), 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cheques</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} cheque{total === 1 ? "" : "s"} com os filtros atuais
            {totalExibido > 0 && ` • Total: ${formatMoney(totalExibido)}`}
          </p>
        </div>
        <Link href="/cheques/novo" className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Novo Cheque
        </Link>
      </div>
      {/* Filtros: aplicar somente ao clicar em Filtrar; exportações separadas */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cliente</label>
            <input
              type="text"
              value={clienteInput}
              onChange={(e) => setClienteInput(e.target.value)}
              className="input-field"
              placeholder="Nome fantasia, razão ou CNPJ"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Banco</label>
            <input
              type="text"
              value={bancoInput}
              onChange={(e) => setBancoInput(e.target.value)}
              className="input-field"
              placeholder="Ex.: Bradesco"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nº cheque</label>
            <input
              type="text"
              value={numeroInput}
              onChange={(e) => setNumeroInput(e.target.value)}
              className="input-field"
              placeholder="Ex.: 003579"
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
              className="input-field font-mono"
              placeholder="ex: 1520 ou #1520"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Nº ordem do cheque ou ID da venda
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end mt-3">
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
            <label className="block text-xs text-gray-500 mb-1">
              Valor mínimo
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorMinInput}
              onChange={(e) => setValorMinInput(e.target.value)}
              className="input-field"
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
              className="input-field"
              placeholder="0,00"
            />
          </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="card p-3 text-center border-2 border-transparent">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CHEQUE_COLOR.ativo}`}
          >
            {STATUS_CHEQUE_LABEL.ativo}
          </span>
          <p className="font-bold text-gray-900 mt-1">
            {resumoMap.get("ativo")?.count ?? cheques.length}
          </p>
          <p className="text-xs text-gray-500">
            {formatMoney(totalExibido)}
          </p>
        </div>
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
                <th className="table-header">Emitente</th>
                <th className="table-header">Venda</th>
                <th className="table-header">Valor</th>
                <th className="table-header">Pré-datado</th>
                <th className="table-header">Compensado em</th>
                <th className="table-header">Status</th>
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
                      {STATUS_CHEQUE_LABEL[c.status as keyof typeof STATUS_CHEQUE_LABEL] || "Ativo"}
                    </span>
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
