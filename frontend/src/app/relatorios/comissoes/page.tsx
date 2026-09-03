"use client";
import { useEffect, useState } from "react";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import { formatMoney, formatDate, localDateInputValue } from "@/lib/utils";
import { VendaOrdemCell } from "@/components/VendaOrdem";
import api from "@/lib/api";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";
import { toast } from "sonner";
import { downloadCsvPtBr } from "@/lib/csv";

interface VendaComissaoLinha {
  id: number;
  numeroVenda?: number | null;
  valorTotal: unknown;
  comissaoCalculada?: number;
  comissaoFinal?: number;
  ajusteComissaoValor?: number;
  ajusteComissaoMotivo?: string | null;
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

function cellInt(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const raw = row[key];
    if (raw == null || raw === "") continue;
    const n = parseInt(String(raw).replace(/[^\d-]/g, ""), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function cellMoney(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const raw = row[key];
    if (raw == null || raw === "") continue;
    const n = parseFloat(String(raw).replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function cellText(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const raw = row[key];
    if (raw == null) continue;
    const s = String(raw).trim();
    if (s) return s;
  }
  return "";
}

export default function ComissoesPage() {
  const [dados, setDados] = useState<ComissaoVendedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [expandido, setExpandido] = useState<number | null>(null);
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    const hoje = new Date();
    const ini = localDateInputValue(
      new Date(hoje.getFullYear(), hoje.getMonth(), 1),
    );
    const fim = localDateInputValue(hoje);
    setDataInicio(ini);
    setDataFim(fim);
    buscar(ini, fim);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial do mês
  }, []);

  const exportarCSV = () => {
    if (!dados.length) return;
    downloadCsvPtBr(
      `comissoes-${dataInicio}-${dataFim}.csv`,
      ["Vendedor", "Qtd Vendas", "Total Vendas", "Comissão %", "Comissão R$"],
      dados.map((d) => [
        d.vendedor.nome,
        d.quantidadeVendas,
        d.totalVendas,
        d.percentual,
        d.comissao,
      ]),
    );
  };

  const exportarTemplateAjustes = async (alvo?: ComissaoVendedor) => {
    const XLSX = await import("xlsx");
    const grupos = alvo ? [alvo] : dados;
    const rows = grupos.flatMap((d) =>
      d.vendas.map((v: any) => ({
        vendedor: d.vendedor.nome,
        vendedorId: d.vendedor.id,
        vendaId: v.id,
        ordem: v.numeroVenda ?? v.id,
        dataVenda: formatDate(v.dataVenda),
        cliente: v.cliente?.nomeFantasia || v.cliente?.razaoSocial || "",
        baseComissao: parseFloat(String(v.valorTotal || 0)),
        comissaoCalculada: parseFloat(String(v.comissaoCalculada || 0)),
        ajusteComissaoValor: parseFloat(String(v.ajusteComissaoValor || 0)),
        comissaoFinal: parseFloat(String(v.comissaoFinal || v.comissaoCalculada || 0)),
        motivoAjuste: v.ajusteComissaoMotivo || "",
      })),
    );
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ajustes Comissao");
    const sufixo = alvo
      ? `${String(alvo.vendedor.nome || `vendedor-${alvo.vendedor.id}`)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || `vendedor-${alvo.vendedor.id}`}`
      : "geral";
    XLSX.writeFile(wb, `comissoes-ajustes-${sufixo}-${dataInicio}-${dataFim}.xlsx`);
  };

  const importarAjustes = async (file: File) => {
    setImportando(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: "",
        raw: true,
      });
      const ajustes = rows
        .map((r) => ({
          vendaId: cellInt(r, ["vendaId", "VendaId", "VENDAID", "id"]),
          numeroVenda: cellInt(r, [
            "ordem",
            "Ordem",
            "numeroVenda",
            "NumeroVenda",
            "nVenda",
          ]),
          ajusteValor: cellMoney(r, [
            "ajusteComissaoValor",
            "ajustevalor",
            "ajuste",
            "AjusteComissaoValor",
          ]),
          motivo: cellText(r, ["motivoAjuste", "motivo", "MotivoAjuste"]),
        }))
        .filter(
          (a) =>
            (a.vendaId > 0 || a.numeroVenda > 0) && Number.isFinite(a.ajusteValor),
        );

      if (!ajustes.length) {
        toast.error("Nenhum ajuste válido encontrado no arquivo.");
        return;
      }
      const resp = await api.post<{
        success: boolean;
        total: number;
        ignorados?: number[];
      }>("/relatorios/comissoes/ajustes-lote", { ajustes });
      const ignorados = resp.ignorados?.length ?? 0;
      if (ignorados > 0) {
        toast.success(
          `${resp.total} ajuste(s) importado(s). ${ignorados} linha(s) ignorada(s) (venda não encontrada).`,
        );
      } else {
        toast.success(`${resp.total} ajuste(s) importado(s).`);
      }
      buscar();
    } catch (e) {
      reportApiError(e, { title: "Não foi possível importar o Excel" });
    } finally {
      setImportando(false);
    }
  };

  const buscar = (ini?: string, fim?: string) => {
    const params = new URLSearchParams();
    if (ini ?? dataInicio) params.set("dataInicio", ini ?? dataInicio);
    if (fim ?? dataFim) params.set("dataFim", fim ?? dataFim);
    setLoading(true);
    api
      .get<{ resultado: ComissaoVendedor[] }>(`/relatorios/comissoes?${params}`)
      .then((r) => {
        setDados(r.resultado);
      })
      .catch((e) => {
        reportApiError(e, { title: "Não foi possível calcular comissões" });
        setDados([]);
      })
      .finally(() => setLoading(false));
  };

  const totalComissao = dados.reduce((acc, d) => acc + d.comissao, 0);
  const totalVendas = dados.reduce((acc, d) => acc + d.totalVendas, 0);

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const quantidadeItensVenda = (v: VendaComissaoLinha & { itens?: Array<{ quantidade?: unknown }> }) => {
    const itens = v.itens;
    if (!Array.isArray(itens)) return 0;
    return itens.reduce(
      (acc, i) => acc + parseFloat(String(i?.quantidade ?? 0)),
      0,
    );
  };

  /** Abre só o representante escolhido; na impressão do navegador use “Salvar como PDF”. */
  const imprimirRepresentante = (d: ComissaoVendedor) => {
    const w = window.open("", "_blank");
    if (!w) return;

    const ini = dataInicio
      ? new Date(dataInicio + "T12:00:00").toLocaleDateString("pt-BR")
      : "";
    const fim = dataFim
      ? new Date(dataFim + "T12:00:00").toLocaleDateString("pt-BR")
      : "";
    const modoLabel = "Emissão (valor na venda)";

    const rowsHtml = d.vendas
      .map((v) => {
        const vx = v as VendaComissaoLinha & {
          cliente?: { nomeFantasia?: string; razaoSocial?: string };
          dataVenda?: string;
          valorTotal?: unknown;
          comissaoCalculada?: number;
          comissaoFinal?: number;
          ajusteComissaoValor?: number;
          ajusteComissaoMotivo?: string | null;
          itens?: Array<{ quantidade?: unknown }>;
        };
        const comBase =
          vx.comissaoCalculada ??
          (parseFloat(String(vx.valorTotal ?? 0)) * d.percentual) / 100;
        const ajuste = parseFloat(String(vx.ajusteComissaoValor ?? 0)) || 0;
        const comFinal =
          vx.comissaoFinal ?? comBase + ajuste;
        const qtd = quantidadeItensVenda(vx);
        const cliente =
          vx.cliente?.nomeFantasia?.trim() || vx.cliente?.razaoSocial || "—";
        const motivo = String(vx.ajusteComissaoMotivo || "").trim();
        return `<tr>
          <td>${escapeHtml(formatDate(String(vx.dataVenda ?? "")))}</td>
          <td class="num">${escapeHtml(formatMoney(parseFloat(String(vx.valorTotal ?? 0))))}</td>
          <td class="num">${escapeHtml(formatMoney(comBase))}</td>
          <td class="num">${escapeHtml(formatMoney(ajuste))}</td>
          <td class="num"><strong>${escapeHtml(formatMoney(comFinal))}</strong></td>
          <td class="num">${qtd.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</td>
          <td>${escapeHtml(cliente)}${motivo ? `<div class="motivo">${escapeHtml(motivo)}</div>` : ""}</td>
        </tr>`;
      })
      .join("");

    const totalQtd = d.vendas.reduce(
      (acc, v) => acc + quantidadeItensVenda(v as VendaComissaoLinha & { itens?: Array<{ quantidade?: unknown }> }),
      0,
    );

    w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Comissões — ${escapeHtml(d.vendedor.nome)} — ${dataInicio} a ${dataFim}</title>
  <style>
    body { font-family: ui-monospace, Consolas, monospace; font-size: 11px; color: #111; margin: 16px; }
    h1 { font-size: 14px; margin: 0 0 8px 0; }
    .periodo { margin-bottom: 12px; line-height: 1.5; }
    .modo { color: #444; margin-bottom: 16px; }
    .rep { font-weight: 700; margin: 12px 0 8px 0; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .tt { margin-top: 12px; font-weight: 700; }
    .hint { margin-top: 16px; font-size: 10px; color: #666; }
    .motivo { font-size: 10px; color: #555; margin-top: 2px; }
  </style>
</head>
<body>
  <h1>Comissões — ${escapeHtml(d.vendedor.nome)}</h1>
  <div class="periodo">
    <div>PERÍODO INICIAL: ${escapeHtml(ini)}</div>
    <div>PERÍODO FINAL: ${escapeHtml(fim)}</div>
  </div>
  <div class="modo">Regra: ${escapeHtml(modoLabel)}</div>
  <div class="rep">${escapeHtml(String(d.vendedor.id).padStart(6, "0"))} — ${escapeHtml(d.vendedor.nome)}</div>
  <table>
    <thead>
      <tr>
        <th>Emissão</th>
        <th class="num">Base cálculo</th>
        <th class="num">Comissão base</th>
        <th class="num">Ajuste</th>
        <th class="num">Comissão</th>
        <th class="num">Quantidade</th>
        <th>Cliente</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || `<tr><td colspan="7" style="text-align:center;color:#666">Nenhuma venda no período.</td></tr>`}</tbody>
  </table>
  <div class="tt">
    TT REPRESENTANTE — Base: ${escapeHtml(formatMoney(d.totalVendas))} · Comissão: ${escapeHtml(formatMoney(d.comissao))} · Quantidade: ${totalQtd.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} · Vendas: ${d.quantidadeVendas}
  </div>
  <p class="hint">Use o diálogo de impressão do navegador e escolha “Salvar como PDF” para gerar o PDF deste representante.</p>
</body>
</html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:px-8 w-full max-w-none">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Comissões por Vendedor
        </h1>
        <p className="text-sm text-gray-500 mt-1.5">
          Comissão sobre o valor da venda (produtos). Ajustes de frete/caminhão entram
          pelo Excel.
        </p>
      </div>

      <div className="card p-4 sm:p-5 mb-6 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="xl:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Fim
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="xl:col-span-8 flex flex-wrap items-end gap-2">
            <button type="button" onClick={() => buscar()} className="btn-primary">
              <MagnifyingGlassIcon className="w-4 h-4" /> Calcular
            </button>
            {dados.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={exportarCSV}
                  className="btn-secondary flex items-center gap-1.5"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" /> Exportar CSV
                </button>
                <label className="btn-secondary flex items-center gap-1.5 cursor-pointer">
                  {importando ? "Importando..." : "Importar Excel Ajustado"}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void importarAjustes(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {loading && (
        <div className="card p-5">
          <TableListSkeleton rows={8} cols={5} />
        </div>
      )}

      {!loading && dados.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 mb-5">
            <div className="card p-5 sm:p-6">
              <p className="text-sm text-gray-500 mb-1">Total em Vendas</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight tabular-nums">
                {formatMoney(totalVendas)}
              </p>
            </div>
            <div className="card p-5 sm:p-6">
              <p className="text-sm text-gray-500 mb-1">Total em Comissões</p>
              <p className="text-2xl sm:text-3xl font-bold text-orange-600 tracking-tight tabular-nums">
                {formatMoney(totalComissao)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {dados.map((d) => (
              <div key={d.vendedor.id} className="card overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(9rem,0.55fr)_minmax(9rem,0.55fr)_auto] gap-3 lg:gap-6 items-center px-4 sm:px-5 py-4 border-b border-gray-100">
                  <button
                    type="button"
                    className="min-w-0 text-left rounded-lg hover:bg-gray-50 transition-colors px-2 py-1 -mx-2"
                    onClick={() =>
                      setExpandido(
                        expandido === d.vendedor.id ? null : d.vendedor.id,
                      )
                    }
                  >
                    <p className="font-semibold text-gray-900 truncate" title={d.vendedor.nome}>
                      {d.vendedor.nome}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {d.quantidadeVendas} vendas • comissão:{" "}
                      {d.percentual.toFixed(2)}%
                    </p>
                  </button>
                  <div className="lg:text-right">
                    <p className="text-xs text-gray-500">Vendas</p>
                    <p className="font-semibold tabular-nums text-base sm:text-lg">
                      {formatMoney(d.totalVendas)}
                    </p>
                  </div>
                  <div className="lg:text-right">
                    <p className="text-xs text-gray-500">Comissão</p>
                    <p className="font-bold text-orange-600 tabular-nums text-base sm:text-lg">
                      {formatMoney(d.comissao)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 print:hidden lg:justify-end">
                    <button
                      type="button"
                      onClick={() => imprimirRepresentante(d)}
                      className="btn-secondary flex items-center gap-1.5 text-sm"
                      title="Abre só este representante; no navegador use Salvar como PDF"
                    >
                      <PrinterIcon className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => exportarTemplateAjustes(d)}
                      className="btn-secondary flex items-center gap-1.5 text-sm"
                      title="Exporta planilha de ajustes somente deste vendedor"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Excel
                    </button>
                  </div>
                </div>
                {expandido === d.vendedor.id && d.vendas.length > 0 && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full min-w-[880px]">
                      <thead>
                        <tr className="border-b border-gray-100 bg-slate-50/80">
                          <th className="table-header text-left px-4 py-3 w-28">
                            Ordem
                          </th>
                          <th className="table-header text-left px-4 py-3">Data</th>
                          <th className="table-header text-left px-4 py-3 min-w-[180px]">
                            Cliente
                          </th>
                          <th className="table-header text-right px-4 py-3">Total</th>
                          <th className="table-header text-right px-4 py-3">
                            Comissão base
                          </th>
                          <th className="table-header text-right px-4 py-3">
                            Ajuste (Excel)
                          </th>
                          <th className="table-header text-right px-4 py-3">
                            Comissão final
                          </th>
                          <th className="table-header text-left px-4 py-3">
                            Motivo ajuste
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.vendas.map((v: any) => (
                          <tr key={v.id} className="table-row bg-gray-50">
                            <VendaOrdemCell venda={v} />
                            <td className="table-cell px-4 py-3">
                              {formatDate(v.dataVenda)}
                            </td>
                            <td className="table-cell px-4 py-3">
                              {v.cliente.nomeFantasia || v.cliente.razaoSocial}
                            </td>
                            <td className="table-cell text-right px-4 py-3 tabular-nums">
                              {formatMoney(v.valorTotal)}
                            </td>
                            <td className="table-cell text-right px-4 py-3 text-orange-600 tabular-nums">
                              {formatMoney(
                                v.comissaoCalculada ??
                                  (parseFloat(String(v.valorTotal)) * d.percentual) /
                                    100,
                              )}
                            </td>
                            <td
                              className={`table-cell text-right px-4 py-3 tabular-nums ${(parseFloat(String(v.ajusteComissaoValor || 0)) || 0) === 0 ? "text-gray-400" : "text-amber-700 font-semibold"}`}
                            >
                              {formatMoney(v.ajusteComissaoValor ?? 0)}
                            </td>
                            <td className="table-cell text-right px-4 py-3 text-orange-700 font-semibold tabular-nums">
                              {formatMoney(
                                v.comissaoFinal ??
                                  (v.comissaoCalculada ??
                                    (parseFloat(String(v.valorTotal)) *
                                      d.percentual) /
                                      100),
                              )}
                            </td>
                            <td className="table-cell px-4 py-3 text-xs text-gray-600">
                              {v.ajusteComissaoMotivo || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
