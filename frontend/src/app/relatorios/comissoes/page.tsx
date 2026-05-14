"use client";
import { useEffect, useState } from "react";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import { formatMoney, formatDate, vendaNumeroPublico, localDateInputValue } from "@/lib/utils";
import api from "@/lib/api";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";
import * as XLSX from "xlsx";

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

type ComissaoModo = "emissao" | "caixa";

export default function ComissoesPage() {
  const [dados, setDados] = useState<ComissaoVendedor[]>([]);
  const [modo, setModo] = useState<ComissaoModo>("emissao");
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
      } catch (e) {
        if (!cancelled) {
          reportApiError(e, { title: "Não foi possível carregar comissões" });
          setDados([]);
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

  const exportarTemplateAjustes = (alvo?: ComissaoVendedor) => {
    const grupos = alvo ? [alvo] : dados;
    const rows = grupos.flatMap((d) =>
      d.vendas.map((v: any) => ({
        vendedor: d.vendedor.nome,
        vendedorId: d.vendedor.id,
        vendaId: v.id,
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
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: "",
      });
      const ajustes = rows
        .map((r) => ({
          vendaId: parseInt(String(r.vendaId || r.VendaId || r.VENDAID || 0), 10),
          ajusteValor: parseFloat(
            String(
              r.ajusteComissaoValor ||
                r.ajustevalor ||
                r.ajuste ||
                r.AjusteComissaoValor ||
                0,
            ).replace(",", "."),
          ),
          motivo: String(r.motivoAjuste || r.motivo || r.MotivoAjuste || "").trim(),
        }))
        .filter((a) => Number.isFinite(a.vendaId) && a.vendaId > 0 && Number.isFinite(a.ajusteValor));

      if (!ajustes.length) {
        alert("Nenhum ajuste válido encontrado no arquivo.");
        return;
      }
      await api.post("/relatorios/comissoes/ajustes-lote", { ajustes });
      buscar();
    } finally {
      setImportando(false);
    }
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
      .catch((e) => {
        reportApiError(e, { title: "Não foi possível calcular comissões" });
        setDados([]);
      })
      .finally(() => setLoading(false));
  };

  const salvarModoPadrao = async () => {
    await api.put("/config", { comissaoModo: modo });
    buscar();
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
    const modoLabel =
      modo === "caixa"
        ? "Caixa (proporcional ao recebido na ordem)"
        : "Emissão (valor na venda)";

    const rowsHtml = d.vendas
      .map((v) => {
        const vx = v as VendaComissaoLinha & {
          cliente?: { nomeFantasia?: string; razaoSocial?: string };
          dataVenda?: string;
          valorTotal?: unknown;
          comissaoCalculada?: number;
          itens?: Array<{ quantidade?: unknown }>;
        };
        const comLinha =
          vx.comissaoCalculada ??
          (parseFloat(String(vx.valorTotal ?? 0)) * d.percentual) / 100;
        const qtd = quantidadeItensVenda(vx);
        const cliente =
          vx.cliente?.nomeFantasia?.trim() || vx.cliente?.razaoSocial || "—";
        return `<tr>
          <td>${escapeHtml(formatDate(String(vx.dataVenda ?? "")))}</td>
          <td class="num">${escapeHtml(formatMoney(parseFloat(String(vx.valorTotal ?? 0))))}</td>
          <td class="num">${escapeHtml(formatMoney(comLinha))}</td>
          <td class="num">${qtd.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</td>
          <td>${escapeHtml(cliente)}</td>
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
        <th class="num">Comissão</th>
        <th class="num">Quantidade</th>
        <th>Cliente</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || `<tr><td colspan="5" style="text-align:center;color:#666">Nenhuma venda no período.</td></tr>`}</tbody>
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

      <div className="card p-4 mb-6 print:hidden">
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
              <button
                type="button"
                onClick={exportarCSV}
                className="btn-secondary flex items-center gap-1"
              >
                <ArrowDownTrayIcon className="w-4 h-4" /> Exportar CSV
              </button>
            )}
            {dados.length > 0 && (
              <label className="btn-secondary flex items-center gap-1 cursor-pointer">
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
              <div className="flex flex-wrap items-stretch justify-between gap-2 px-5 py-4 border-b border-gray-100">
                <button
                  type="button"
                  className="flex-1 min-w-[200px] text-left rounded-lg hover:bg-gray-50 transition-colors px-2 py-1 -ml-2"
                  onClick={() =>
                    setExpandido(
                      expandido === d.vendedor.id ? null : d.vendedor.id,
                    )
                  }
                >
                  <p className="font-semibold text-gray-900">
                    {d.vendedor.nome}
                  </p>
                  <p className="text-xs text-gray-400">
                    {d.quantidadeVendas} vendas • comissão:{" "}
                    {d.percentual.toFixed(2)}%
                  </p>
                </button>
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
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
                  <button
                    type="button"
                    onClick={() => imprimirRepresentante(d)}
                    className="btn-secondary flex items-center gap-1 text-sm shrink-0 print:hidden"
                    title="Abre só este representante; no navegador use Salvar como PDF"
                  >
                    <PrinterIcon className="w-4 h-4" />
                    PDF (este)
                  </button>
                  <button
                    type="button"
                    onClick={() => exportarTemplateAjustes(d)}
                    className="btn-secondary flex items-center gap-1 text-sm shrink-0 print:hidden"
                    title="Exporta planilha de ajustes somente deste vendedor"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Excel (este)
                  </button>
                </div>
              </div>
              {expandido === d.vendedor.id && d.vendas.length > 0 && (
                <div className="border-t border-gray-100">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="table-header">#</th>
                        <th className="table-header">Data</th>
                        <th className="table-header">Cliente</th>
                        <th className="table-header text-right">Total</th>
                        <th className="table-header text-right">Comissão base</th>
                        <th className="table-header text-right">Ajuste (Excel)</th>
                        <th className="table-header text-right">Comissão final</th>
                        <th className="table-header">Motivo ajuste</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.vendas.map((v: any) => (
                        <tr key={v.id} className="table-row bg-gray-50">
                          <td className="table-cell text-gray-400">#{vendaNumeroPublico(v)}</td>
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
                                (parseFloat(String(v.valorTotal)) * d.percentual) / 100,
                            )}
                          </td>
                          <td
                            className={`table-cell text-right ${(parseFloat(String(v.ajusteComissaoValor || 0)) || 0) === 0 ? "text-gray-400" : "text-amber-700 font-semibold"}`}
                          >
                            {formatMoney(v.ajusteComissaoValor ?? 0)}
                          </td>
                          <td className="table-cell text-right text-orange-700 font-semibold">
                            {formatMoney(
                              v.comissaoFinal ??
                                (v.comissaoCalculada ??
                                  (parseFloat(String(v.valorTotal)) * d.percentual) / 100),
                            )}
                          </td>
                          <td className="table-cell text-xs text-gray-600">
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
        </>
      )}
    </div>
  );
}
