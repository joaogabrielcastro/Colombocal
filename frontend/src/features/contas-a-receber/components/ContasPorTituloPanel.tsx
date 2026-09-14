"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDate, formatMoney, type Cliente, type Vendedor } from "@/lib/utils";
import { VendaOrdem, vendaOrdemTexto } from "@/components/VendaOrdem";
import api, { apiFetchWithMeta } from "@/lib/api";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import SearchableSelect from "@/components/SearchableSelect";
import { ArrowDownTrayIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { reportApiError } from "@/lib/report-api-error";
import { useExportCsvAsync } from "@/features/relatorios-shared/hooks/useExportCsvAsync";
import { CONTAS_PAGE_SIZE } from "../constants";
import { downloadXlsx, nomeArquivoExcel } from "../services/exportExcel";
import { fetchTodasPaginas } from "../services/fetchPaginas";
import {
  atrasoDoTitulo,
  classStatusTitulo,
  diasAteVencerDoTitulo,
  labelStatusTitulo,
  saldoAbertoTitulo,
  venceHojeDoTitulo,
} from "../services/display";
import { ContasAgingFaixas } from "./ContasAgingFaixas";
import { ContasKpiCards } from "./ContasKpiCards";
import { ContasPrintMeta } from "./ContasPrintMeta";
import { FiltrosRapidosSituacao } from "./FiltrosRapidosSituacao";
import { SituacaoVencimento } from "./SituacaoVencimento";
import type { SituacaoFiltro, TituloItem, TitulosResponse } from "../types";

type Props = {
  initialClienteId?: string;
};

export function ContasPorTituloPanel({ initialClienteId = "" }: Props) {
  const [dados, setDados] = useState<TitulosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = CONTAS_PAGE_SIZE;

  const [clienteId, setClienteId] = useState(initialClienteId);
  const [vendedorId, setVendedorId] = useState("");
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendaIdFiltro, setVendaIdFiltro] = useState("");
  const [status, setStatus] = useState("");
  const [dataVencInicio, setDataVencInicio] = useState("");
  const [dataVencFim, setDataVencFim] = useState("");
  const [somenteEmAberto, setSomenteEmAberto] = useState(true);
  const [situacao, setSituacao] = useState<SituacaoFiltro>("");
  const [ordenarMaiorAtraso, setOrdenarMaiorAtraso] = useState(true);
  const [exportando, setExportando] = useState(false);
  const csv = useExportCsvAsync({ startPath: "/relatorios/titulos/export-async" });

  useEffect(() => {
    api
      .get<Vendedor[]>("/vendedores?take=500")
      .then(setVendedores)
      .catch(() => setVendedores([]));
  }, []);

  useEffect(() => {
    if (initialClienteId) setClienteId(initialClienteId);
  }, [initialClienteId]);

  const carregar = useCallback(
    async (targetPage = page) => {
      const params = new URLSearchParams();
      if (clienteId) params.set("clienteId", clienteId);
      const vid = vendaIdFiltro.replace(/^#/, "").trim();
      if (vid) params.set("vendaId", vid);
      if (status) params.set("status", status);
      if (dataVencInicio) params.set("dataVencInicio", dataVencInicio);
      if (dataVencFim) params.set("dataVencFim", dataVencFim);
      if (somenteEmAberto) params.set("somenteEmAberto", "true");
      if (vendedorId) params.set("vendedorId", vendedorId);
      if (situacao) params.set("situacao", situacao);
      params.set("take", String(pageSize));
      params.set("skip", String((targetPage - 1) * pageSize));
      setLoading(true);
      setErro("");
      try {
        const { data, meta } = await apiFetchWithMeta<TitulosResponse>(
          `/relatorios/titulos?${params.toString()}`,
          { method: "GET" },
        );
        setDados(data);
        setTotal(meta.totalCount ?? data.resumo.totalTitulos);
      } catch (e) {
        setErro("Não foi possível carregar os títulos.");
        reportApiError(e, {
          title: "Erro ao carregar títulos",
          onRetry: () => void carregar(targetPage),
        });
      } finally {
        setLoading(false);
      }
    },
    [
      clienteId,
      vendedorId,
      vendaIdFiltro,
      status,
      dataVencInicio,
      dataVencFim,
      somenteEmAberto,
      situacao,
      pageSize,
      page,
    ],
  );

  useEffect(() => {
    void carregar(page);
  }, [carregar, page]);

  const loadClienteOptions = useCallback(async (q: string) => {
    const p = new URLSearchParams({ ativo: "true", take: "40" });
    if (q.trim()) p.set("busca", q.trim());
    const r = await api.get<{ clientes: Cliente[] }>(`/clientes?${p}`);
    return r.clientes.map((c) => ({
      id: c.id,
      label: (c.nomeFantasia?.trim() || c.razaoSocial) as string,
    }));
  }, []);

  const loadClienteLabelById = useCallback(async (cid: string) => {
    const c = await api.get<Cliente>(`/clientes/${cid}`);
    return (c.nomeFantasia?.trim() || c.razaoSocial) ?? null;
  }, []);

  const representanteDoTitulo = (t: TituloItem) =>
    t.venda?.vendedor?.nome || t.cliente.vendedor?.nome || "—";

  const titulosOrdenados = [...(dados?.titulos || [])].sort((a, b) => {
    if (!ordenarMaiorAtraso) {
      return new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime();
    }
    const abertoA = saldoAbertoTitulo(a);
    const abertoB = saldoAbertoTitulo(b);
    const atrasoA = atrasoDoTitulo(a, abertoA);
    const atrasoB = atrasoDoTitulo(b, abertoB);
    if (atrasoB !== atrasoA) return atrasoB - atrasoA;
    return abertoB - abertoA;
  });

  const linhasExcelDeTitulos = (lista: TituloItem[]) =>
    lista.map((t) => {
      const aberto = saldoAbertoTitulo(t);
      return {
        Título: t.numero || `#${t.id}`,
        Cliente: t.cliente.nomeFantasia || t.cliente.razaoSocial,
        Representante: representanteDoTitulo(t),
        Venda: t.venda ? `Venda ${vendaOrdemTexto(t.venda)}` : "-",
        Vencimento: formatDate(t.vencimento),
        "Valor original": parseFloat(String(t.valorOriginal)),
        "Valor pago": parseFloat(String(t.valorPago)),
        "Valor em aberto": aberto,
        "Dias atraso": atrasoDoTitulo(t, aberto),
        Status: t.status,
      };
    });

  const paramsFiltroTitulos = () => {
    const params = new URLSearchParams();
    if (clienteId) params.set("clienteId", clienteId);
    const vid = vendaIdFiltro.replace(/^#/, "").trim();
    if (vid) params.set("vendaId", vid);
    if (status) params.set("status", status);
    if (dataVencInicio) params.set("dataVencInicio", dataVencInicio);
    if (dataVencFim) params.set("dataVencFim", dataVencFim);
    if (somenteEmAberto) params.set("somenteEmAberto", "true");
    if (vendedorId) params.set("vendedorId", vendedorId);
    if (situacao) params.set("situacao", situacao);
    return params;
  };

  const exportarExcel = async () => {
    setExportando(true);
    try {
      const { items, truncated } = await fetchTodasPaginas<TitulosResponse>({
        path: "/relatorios/titulos",
        params: paramsFiltroTitulos(),
        pick: (data) => data.titulos,
        totalFrom: (data, metaTotal) => metaTotal ?? data.resumo.totalTitulos,
      });
      let lista = items as TituloItem[];
      if (ordenarMaiorAtraso) {
        lista = [...lista].sort((a, b) => {
          const abertoA = saldoAbertoTitulo(a);
          const abertoB = saldoAbertoTitulo(b);
          const atrasoA = atrasoDoTitulo(a, abertoA);
          const atrasoB = atrasoDoTitulo(b, abertoB);
          if (atrasoB !== atrasoA) return atrasoB - atrasoA;
          return abertoB - abertoA;
        });
      }
      downloadXlsx(
        nomeArquivoExcel("contas-receber-titulos"),
        "Títulos",
        linhasExcelDeTitulos(lista),
      );
      if (truncated) {
        toast.message("Excel limitado aos primeiros 5.000 títulos do filtro.");
      }
    } catch {
      toast.error("Não foi possível gerar o Excel.");
    } finally {
      setExportando(false);
    }
  };

  const aplicarSituacaoRapida = (next: SituacaoFiltro) => {
    setSituacao(next);
    setSomenteEmAberto(true);
    setPage(1);
  };

  const limparFiltros = () => {
    setClienteId("");
    setVendedorId("");
    setVendaIdFiltro("");
    setStatus("");
    setDataVencInicio("");
    setDataVencFim("");
    setSomenteEmAberto(true);
    setSituacao("");
    setOrdenarMaiorAtraso(true);
    setPage(1);
  };

  const imprimirRelatorio = () => {
    const tituloAnterior = document.title;
    document.title = "Contas a receber — por título";
    window.print();
    document.title = tituloAnterior;
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const nomeRepresentante =
    vendedores.find((v) => String(v.id) === vendedorId)?.nome || "";
  const filtrosAtivos = Boolean(
    clienteId ||
      vendedorId ||
      vendaIdFiltro ||
      status ||
      dataVencInicio ||
      dataVencFim ||
      situacao ||
      !somenteEmAberto,
  );

  const kpis = dados
    ? [
        { label: "Títulos", value: String(dados.resumo.totalTitulos) },
        { label: "Original", value: formatMoney(dados.resumo.valorOriginal) },
        { label: "Pago", value: formatMoney(dados.resumo.valorPago) },
        {
          label: "Em aberto",
          value: formatMoney(dados.resumo.valorEmAberto),
        },
        {
          label: "Vencido",
          value: formatMoney(dados.resumo.totalVencido ?? dados.resumo.faixas.vencidos),
          tone: "danger" as const,
        },
        {
          label: "A vencer",
          value: formatMoney(
            dados.resumo.totalAVencer ??
              dados.resumo.faixas.ate30 +
                dados.resumo.faixas.de31a60 +
                dados.resumo.faixas.de61a90 +
                dados.resumo.faixas.acima90,
          ),
          tone: "muted" as const,
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 leading-relaxed max-w-3xl print:hidden">
        Parcelas em aberto por título (aging). O valor de uma linha pode diferir do
        saldo global da conta corrente do cliente.
      </p>

      <ContasPrintMeta
        visao="Por título"
        linhas={[
          clienteId ? `Cliente #${clienteId}` : "",
          nomeRepresentante ? `Representante: ${nomeRepresentante}` : "",
          vendaIdFiltro ? `Venda ${vendaIdFiltro}` : "",
          status ? `Status: ${status}` : "",
          dataVencInicio ? `Venc. de ${dataVencInicio}` : "",
          dataVencFim ? `Venc. até ${dataVencFim}` : "",
          somenteEmAberto ? "Somente em aberto" : "",
          situacao === "vencidos"
            ? "Situação: vencidos"
            : situacao === "a_vencer"
              ? "Situação: a vencer"
              : "",
        ]}
      />

      {clienteId ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 print:hidden">
          <Link
            href={`/clientes/${clienteId}?aba=conta`}
            className="font-medium text-blue-700 underline hover:text-blue-900"
          >
            Ver dados, vendas, títulos e pagamentos deste cliente
          </Link>
        </div>
      ) : null}

      <FilterBar className="p-4 sm:p-5 mb-0 print:hidden">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
            Filtro rápido
          </p>
          <FiltrosRapidosSituacao
            value={situacao}
            somenteEmAberto={somenteEmAberto}
            onChange={aplicarSituacaoRapida}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-3">
            <SearchableSelect
              label="Cliente"
              value={clienteId}
              onChange={(id) => {
                setClienteId(id);
                setPage(1);
              }}
              loadOptions={loadClienteOptions}
              loadLabelById={loadClienteLabelById}
              minChars={0}
              placeholder="Todos os clientes"
              emptyHint="Digite para buscar ou deixe em branco para todos."
            />
          </div>
          <div className="xl:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Representante
            </label>
            <select
              value={vendedorId}
              onChange={(e) => {
                setVendedorId(e.target.value);
                setPage(1);
              }}
              className="input-field w-full"
            >
              <option value="">Todos</option>
              {vendedores.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  {v.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="xl:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nº venda (ordem)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={vendaIdFiltro}
              onChange={(e) => setVendaIdFiltro(e.target.value)}
              className="input-field font-mono"
              placeholder="ex: 1840"
            />
          </div>
          <div className="xl:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="input-field"
            >
              <option value="">Todos</option>
              <option value="aberto">Aberto</option>
              <option value="parcial">Parcial</option>
              <option value="quitado">Quitado</option>
            </select>
          </div>
          <div className="xl:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venc. início
            </label>
            <input
              type="date"
              value={dataVencInicio}
              onChange={(e) => setDataVencInicio(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="xl:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venc. fim
            </label>
            <input
              type="date"
              value={dataVencFim}
              onChange={(e) => setDataVencFim(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={somenteEmAberto}
              onChange={(e) => {
                setSomenteEmAberto(e.target.checked);
                setPage(1);
              }}
            />
            Somente em aberto (aberto/parcial)
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={ordenarMaiorAtraso}
              onChange={(e) => setOrdenarMaiorAtraso(e.target.checked)}
            />
            Ordenar por maior atraso
          </label>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => {
                if (page === 1) {
                  void carregar(1);
                } else {
                  setPage(1);
                }
              }}
              className="btn-primary"
            >
              Filtrar
            </button>
            {filtrosAtivos ? (
              <button type="button" className="btn-secondary" onClick={limparFiltros}>
                Limpar
              </button>
            ) : null}
            <button
              type="button"
              onClick={imprimirRelatorio}
              className="btn-secondary flex items-center gap-1.5"
            >
              <PrinterIcon className="w-4 h-4" /> Imprimir
            </button>
            <button
              type="button"
              onClick={() => void exportarExcel()}
              disabled={exportando}
              className="btn-secondary flex items-center gap-1.5"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              {exportando ? "Gerando Excel..." : "Exportar Excel"}
            </button>
            <button
              type="button"
              onClick={() =>
                void csv.exportCsv({
                  clienteId,
                  vendaId: vendaIdFiltro.replace(/^#/, "").trim(),
                  status,
                  dataVencInicio,
                  dataVencFim,
                  somenteEmAberto,
                  vendedorId,
                  situacao,
                })
              }
              disabled={csv.isExporting}
              className="btn-secondary flex items-center gap-1.5"
            >
              {csv.isExporting ? "Gerando CSV..." : "Exportar CSV"}
            </button>
          </div>
        </div>
        {csv.error ? <p className="mt-2 text-sm text-red-600">{csv.error}</p> : null}
      </FilterBar>

      {loading && !dados ? (
        <div className="card p-5">
          <TableListSkeleton rows={8} cols={9} />
        </div>
      ) : null}

      {erro && !dados ? (
        <EmptyState
          title="Não foi possível carregar os títulos"
          description={erro}
          action={
            <button type="button" className="btn-primary" onClick={() => void carregar(page)}>
              Tentar novamente
            </button>
          }
        />
      ) : null}

      {dados ? (
        <>
          <ContasKpiCards items={kpis} />
          <ContasAgingFaixas faixas={dados.resumo.faixas} />

          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-5">
                <TableListSkeleton rows={8} cols={9} />
              </div>
            ) : dados.titulos.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="Nenhum título encontrado para os filtros selecionados."
                  description="Ajuste cliente, venda, vencimento ou situação, ou limpe os filtros."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-gray-200 bg-slate-50/80">
                  <th className="table-header text-left px-4 py-3.5 whitespace-nowrap">
                    Título
                  </th>
                  <th className="table-header text-left px-4 py-3.5 min-w-[200px] w-[22%]">
                    Cliente
                  </th>
                  <th className="table-header text-left px-4 py-3.5 w-32 bg-slate-50">
                    Ordem
                  </th>
                  <th className="table-header text-left px-4 py-3.5 whitespace-nowrap">
                    Vencimento
                  </th>
                  <th className="table-header text-right px-4 py-3.5">Original</th>
                  <th className="table-header text-right px-4 py-3.5">Pago</th>
                  <th className="table-header text-right px-4 py-3.5">Em aberto</th>
                  <th className="table-header text-left px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {titulosOrdenados.map((t) => {
                  const aberto = saldoAbertoTitulo(t);
                  const diasAtraso = atrasoDoTitulo(t, aberto);
                  const diasAte = diasAteVencerDoTitulo(t, aberto);
                  const venceHoje = venceHojeDoTitulo(t, aberto);
                  return (
                    <tr key={t.id} className="table-row">
                      <td className="table-cell px-4 py-3.5 font-mono whitespace-nowrap">
                        {t.numero || `#${t.id}`}
                      </td>
                      <td className="table-cell px-4 py-3.5">
                        <Link
                          href={`/clientes/${t.cliente.id}?aba=conta`}
                          className="text-blue-600 hover:underline font-medium"
                          title={t.cliente.nomeFantasia || t.cliente.razaoSocial}
                        >
                          {t.cliente.nomeFantasia || t.cliente.razaoSocial}
                        </Link>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {representanteDoTitulo(t)}
                        </div>
                        <div className="mt-0.5 print:hidden">
                          <Link
                            href={`/financeiro/novo?clienteId=${t.cliente.id}`}
                            className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
                          >
                            Receber
                          </Link>
                        </div>
                      </td>
                      <td className="table-cell px-4 py-3.5">
                        {t.venda ? (
                          <VendaOrdem venda={t.venda} size="sm" prefix="Venda" />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="table-cell px-4 py-3.5 whitespace-nowrap">
                        {formatDate(t.vencimento)}
                      </td>
                      <td className="table-cell text-right px-4 py-3.5 tabular-nums">
                        {formatMoney(t.valorOriginal)}
                      </td>
                      <td className="table-cell text-right px-4 py-3.5 tabular-nums">
                        {formatMoney(t.valorPago)}
                      </td>
                      <td className="table-cell px-4 py-3.5">
                        <SituacaoVencimento
                          aberto={aberto}
                          diasAtraso={diasAtraso}
                          diasAteVencer={diasAte}
                          venceHoje={venceHoje}
                        />
                      </td>
                      <td className="table-cell px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${classStatusTitulo(t.status)}`}
                          >
                            {labelStatusTitulo(t.status)}
                          </span>
                          {diasAtraso > 0 && t.status !== "quitado" ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700">
                              Vencido
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600 print:hidden">
        <p>
          Total de registros (filtro): {total} · {pageSize} por página
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
          </button>
        </div>
      </div>
        </>
      ) : null}
    </div>
  );
}
