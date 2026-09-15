"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownTrayIcon,
  ArchiveBoxArrowDownIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import api from "@/lib/api";
import { formatMoney, formatDate, localDateInputValue } from "@/lib/utils";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";
import { toast } from "sonner";
import { NfeStatusBadge } from "@/features/nfe/status";
import { HomologacaoBanner } from "@/features/fiscal/components/HomologacaoBanner";
import { FiscalKpiCards } from "@/features/fiscal/components/FiscalKpiCards";
import { downloadFiscalXlsx } from "@/features/fiscal/services/exportExcel";
import {
  qsFiscal,
  formatChave,
  mesParaPeriodo,
  periodoParaMes,
} from "@/features/fiscal/services/query";
import type { FiscalFechamento } from "@/features/fiscal/types";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { waitForAsyncExportDownloadUrl } from "@/lib/async-export";

export default function FiscalFechamentoPage() {
  const { nfeEnabled, loading: featLoading } = useTenantFeatures();
  const [anoMes, setAnoMes] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [fechamento, setFechamento] = useState<FiscalFechamento | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [pacote, setPacote] = useState(false);

  useEffect(() => {
    const hoje = new Date();
    const ym = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    setAnoMes(ym);
    const { dataInicio: di, dataFim: df } = mesParaPeriodo(ym);
    const fimHoje = localDateInputValue(hoje);
    setDataInicio(di);
    setDataFim(fimHoje < df ? fimHoje : df);
  }, []);

  const consultar = useCallback(async (di: string, df: string) => {
    if (!di || !df) {
      toast.error("Informe o período.");
      return;
    }
    setLoading(true);
    try {
      const q = qsFiscal({ dataInicio: di, dataFim: df });
      const data = await api.get<FiscalFechamento>(`/fiscal/fechamento${q}`);
      setFechamento(data);
    } catch (err) {
      reportApiError(err, { title: "Não foi possível gerar o fechamento." });
      setFechamento(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (nfeEnabled && dataInicio && dataFim) {
      void consultar(dataInicio, dataFim);
    }
  }, [nfeEnabled]); // eslint-disable-line react-hooks/exhaustive-deps -- carga inicial

  const onMesChange = (ym: string) => {
    setAnoMes(ym);
    if (/^\d{4}-\d{2}$/.test(ym)) {
      const p = mesParaPeriodo(ym);
      setDataInicio(p.dataInicio);
      setDataFim(p.dataFim);
    }
  };

  const exportarExcel = async () => {
    if (!dataInicio || !dataFim) return;
    setExportando(true);
    try {
      const q = qsFiscal({ dataInicio, dataFim });
      const data = await api.get<{ rows: Array<Record<string, unknown>> }>(
        `/fiscal/fechamento/export${q}`,
      );
      downloadFiscalXlsx(
        `relatorio-nfe-${periodoParaMes(dataInicio)}.xlsx`,
        data.rows || [],
      );
      toast.success("Excel gerado.");
    } catch (err) {
      reportApiError(err, { title: "Falha ao exportar Excel." });
    } finally {
      setExportando(false);
    }
  };

  const baixarPacote = async () => {
    if (!dataInicio || !dataFim) return;
    setPacote(true);
    try {
      const downloadUrl = await waitForAsyncExportDownloadUrl(
        api,
        "/fiscal/fechamento/pacote",
        { dataInicio, dataFim },
        { pollIntervalMs: 800, maxAttempts: 90 },
      );
      const path = downloadUrl.replace(/^\/api/, "");
      const { blob, filename } = await api.getBlob(path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `fechamento-${periodoParaMes(dataInicio)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Pacote contábil baixado.");
    } catch (err) {
      reportApiError(err, { title: "Falha ao gerar pacote contábil." });
    } finally {
      setPacote(false);
    }
  };

  if (featLoading) {
    return (
      <div className="p-6">
        <TableListSkeleton rows={6} />
      </div>
    );
  }

  if (!nfeEnabled) {
    return (
      <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-semibold">Fechamento fiscal</h1>
        <p className="mt-2 text-sm text-slate-600">
          Módulo NF-e desabilitado. Ative em Configurações.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:px-8 w-full max-w-none">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Fechamento fiscal</h1>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
          Relatório para conferência e envio à contabilidade. Não substitui obrigações
          acessórias ou escrituração fiscal do contador.
        </p>
      </div>

      <HomologacaoBanner ambiente={fechamento?.ambiente} />

      <div className="card mb-4 p-4 flex flex-wrap items-end gap-3 lg:gap-4">
        <label className="text-sm">
          <span className="text-slate-600">Mês</span>
          <input
            type="month"
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
            value={anoMes}
            onChange={(e) => onMesChange(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">De</span>
          <input
            type="date"
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Até</span>
          <input
            type="date"
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium"
          onClick={() => void consultar(dataInicio, dataFim)}
        >
          <MagnifyingGlassIcon className="w-4 h-4" />
          Consultar / Gerar fechamento
        </button>
        <button
          type="button"
          disabled={exportando || !fechamento}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-40"
          onClick={() => void exportarExcel()}
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          Exportar Excel
        </button>
        <button
          type="button"
          disabled={pacote || !fechamento}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-40"
          onClick={() => void baixarPacote()}
        >
          <ArchiveBoxArrowDownIcon className="w-4 h-4" />
          Baixar pacote contábil
        </button>
      </div>

      {loading ? <TableListSkeleton rows={8} /> : null}

      {fechamento && !loading ? (
        <>
          <p className="text-sm text-slate-700 mb-3">
            Período:{" "}
            <strong>
              {formatDate(fechamento.periodo.dataInicio)} →{" "}
              {formatDate(fechamento.periodo.dataFim)}
            </strong>
            {fechamento.empresa ? (
              <span className="ml-3 text-slate-500">
                {fechamento.empresa.razaoSocial} · CNPJ {fechamento.empresa.cnpj}
              </span>
            ) : null}
          </p>

          <FiscalKpiCards
            resumo={fechamento.resumo}
            observacao={fechamento.observacaoEmissaoIncerta}
          />

          {fechamento.lacunas.length > 0 ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Possível lacuna de numeração</p>
              <p className="text-xs mt-1 text-amber-800">
                Não é classificação automática de erro fiscal — investigue (ex.: inutilização
                fora do sistema).
              </p>
              <ul className="mt-2 list-disc pl-5">
                {fechamento.lacunas.map((l) => (
                  <li key={l.serie}>
                    Série {l.serie}: {l.numerosAusentes.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {fechamento.canceladas.length > 0 ? (
            <section className="mb-4">
              <h2 className="text-base font-semibold mb-2">
                Canceladas no período: {fechamento.canceladas.length}
              </h2>
              <ul className="text-sm space-y-1 rounded-lg border border-slate-200 bg-white p-3">
                {fechamento.canceladas.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/fiscal/notas/${n.id}`}
                      className="text-sky-700 hover:underline"
                    >
                      NF {n.numero ?? n.id}
                    </Link>
                    {n.motivoCancelamento ? (
                      <span className="text-slate-500"> — {n.motivoCancelamento}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {fechamento.rejeitadas.length > 0 ? (
            <section className="mb-4">
              <h2 className="text-base font-semibold mb-2">
                Rejeitadas no período: {fechamento.rejeitadas.length}
              </h2>
              <ul className="text-sm space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                {fechamento.rejeitadas.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/fiscal/notas/${n.id}`}
                      className="text-sky-700 hover:underline"
                    >
                      NF-e {n.numero ?? n.id}
                    </Link>
                    <span className="ml-2">
                      <NfeStatusBadge status="rejeitada" />
                    </span>
                    {n.motivoRejeicao ? (
                      <p className="text-red-700 text-xs mt-0.5">{n.motivoRejeicao}</p>
                    ) : null}
                    {n.venda ? (
                      <p className="text-xs text-slate-500">
                        Venda{" "}
                        <Link
                          href={`/vendas/${n.venda.id}`}
                          className="text-sky-700 hover:underline"
                        >
                          #{n.venda.numeroVenda ?? n.venda.id}
                        </Link>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3">Nº</th>
                  <th className="px-4 py-3">Série</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">CNPJ/CPF</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Chave</th>
                </tr>
              </thead>
              <tbody>
                {fechamento.documentos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      Nenhuma NF-e no período selecionado.
                    </td>
                  </tr>
                ) : (
                  fechamento.documentos.map((n) => (
                  <tr key={n.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/fiscal/notas/${n.id}`}
                        className="text-sky-700 hover:underline"
                      >
                        {n.numero ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{n.serie ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {n.dataReferencia ? formatDate(n.dataReferencia) : "—"}
                    </td>
                    <td className="px-4 py-2.5">{n.cliente?.nome || "—"}</td>
                    <td className="px-4 py-2.5">
                      {n.cliente?.cnpj || n.cliente?.cpf || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatMoney(n.valor)}
                    </td>
                    <td className="px-4 py-2.5">
                      <NfeStatusBadge status={n.status} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs max-w-[280px] truncate" title={n.chaveAcesso || ""}>
                      {n.chaveAcesso ? formatChave(n.chaveAcesso) : "—"}
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-500">{fechamento.disclaimer}</p>
        </>
      ) : null}
    </div>
  );
}
