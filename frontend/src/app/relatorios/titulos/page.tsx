"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDate, formatMoney, type Cliente } from "@/lib/utils";
import api from "@/lib/api";
import { TableListSkeleton } from "@/components/ui/skeletons";
import SearchableSelect from "@/components/SearchableSelect";
import * as XLSX from "xlsx";

interface TituloItem {
  id: number;
  numero?: string | null;
  vencimento: string;
  valorOriginal: number;
  valorPago: number;
  status: "aberto" | "parcial" | "quitado";
  cliente: { id: number; razaoSocial: string; nomeFantasia?: string | null };
  venda?: { id: number; dataVenda: string; valorTotal: number } | null;
}

interface TitulosResponse {
  titulos: TituloItem[];
  resumo: {
    totalTitulos: number;
    valorOriginal: number;
    valorPago: number;
    valorEmAberto: number;
    faixas: {
      vencidos: number;
      ate30: number;
      de31a60: number;
      de61a90: number;
      acima90: number;
    };
  };
}

function RelatorioTitulosContent() {
  const searchParams = useSearchParams();
  const [dados, setDados] = useState<TitulosResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [clienteId, setClienteId] = useState(
    () => searchParams.get("clienteId") ?? "",
  );
  const [vendaIdFiltro, setVendaIdFiltro] = useState("");
  const [status, setStatus] = useState("");
  const [dataVencInicio, setDataVencInicio] = useState("");
  const [dataVencFim, setDataVencFim] = useState("");
  const [somenteEmAberto, setSomenteEmAberto] = useState(true);
  const [ordenarMaiorAtraso, setOrdenarMaiorAtraso] = useState(true);

  const carregar = () => {
    const params = new URLSearchParams();
    if (clienteId) params.set("clienteId", clienteId);
    const vid = vendaIdFiltro.replace(/^#/, "").trim();
    if (vid) params.set("vendaId", vid);
    if (status) params.set("status", status);
    if (dataVencInicio) params.set("dataVencInicio", dataVencInicio);
    if (dataVencFim) params.set("dataVencFim", dataVencFim);
    if (somenteEmAberto) params.set("somenteEmAberto", "true");
    setLoading(true);
    api
      .get<TitulosResponse>(`/relatorios/titulos?${params.toString()}`)
      .then(setDados)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregar();
  }, []);

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

  const getDiasAtraso = (vencimento: string, valorAberto: number) => {
    if (valorAberto <= 0.009) return 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(vencimento);
    venc.setHours(0, 0, 0, 0);
    const diffMs = hoje.getTime() - venc.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  const titulosOrdenados = [...(dados?.titulos || [])].sort((a, b) => {
    if (!ordenarMaiorAtraso) {
      return new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime();
    }
    const abertoA = Math.max(
      0,
      parseFloat(String(a.valorOriginal)) - parseFloat(String(a.valorPago)),
    );
    const abertoB = Math.max(
      0,
      parseFloat(String(b.valorOriginal)) - parseFloat(String(b.valorPago)),
    );
    const atrasoA = getDiasAtraso(a.vencimento, abertoA);
    const atrasoB = getDiasAtraso(b.vencimento, abertoB);
    if (atrasoB !== atrasoA) return atrasoB - atrasoA;
    return abertoB - abertoA;
  });

  const getExportRows = () =>
    titulosOrdenados.map((t) => {
      const aberto = Math.max(
        0,
        parseFloat(String(t.valorOriginal)) - parseFloat(String(t.valorPago)),
      );
      return {
        titulo: t.numero || `#${t.id}`,
        cliente: t.cliente.nomeFantasia || t.cliente.razaoSocial,
        venda: t.venda ? `Venda #${t.venda.id}` : "-",
        vencimento: formatDate(t.vencimento),
        valorOriginal: parseFloat(String(t.valorOriginal)),
        valorPago: parseFloat(String(t.valorPago)),
        valorEmAberto: aberto,
        diasAtraso: getDiasAtraso(t.vencimento, aberto),
        status: t.status,
      };
    });

  const exportarCsv = () => {
    if (!dados) return;
    const rows = getExportRows();
    const header =
      "Título,Cliente,Venda,Vencimento,Valor Original,Valor Pago,Valor em Aberto,Dias Atraso,Status";
    const body = rows
      .map((r) =>
        [
          r.titulo,
          r.cliente,
          r.venda,
          r.vencimento,
          r.valorOriginal.toFixed(2),
          r.valorPago.toFixed(2),
          r.valorEmAberto.toFixed(2),
          String(r.diasAtraso),
          r.status,
        ]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + "\n" + body], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `titulos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarExcel = () => {
    if (!dados) return;
    const rows = getExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Titulos");
    XLSX.writeFile(wb, `titulos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Títulos a Receber</h1>
        <p className="text-gray-500 text-sm mt-1">
          Parcelas em aberto por título (aging). Não é o mesmo número que o saldo da conta corrente.
        </p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium text-amber-900">Por que aparece R$ em aberto e na conta o cliente está com crédito?</p>
          <p className="mt-2 text-amber-900/90">
            Cada linha desta tela mostra <strong>um título</strong> (parcela da venda). O valor{" "}
            <strong>Aberto</strong> é só daquela linha: valor original do título menos o que foi
            registrado como pago <em>naquele título</em> (ex.: venda 16 mil, pagamentos ligados a ela 11
            mil → restam 5 mil neste título).
          </p>
          <p className="mt-2 text-amber-900/90">
            Já a <strong>Conta corrente</strong> do cliente soma <strong>todas</strong> as vendas e{" "}
            <strong>todos</strong> os pagamentos. Se em outra venda o cliente pagou a mais, isso vira{" "}
            <strong>crédito</strong> no saldo geral — mas o título da primeira venda pode continuar{" "}
            <span className="font-medium">parcial</span> até você baixar proporcionalmente nessa venda ou
            quitar esse título.
          </p>
          {clienteId ? (
            <p className="mt-2">
              <Link
                href={`/clientes/${clienteId}?aba=conta`}
                className="font-medium text-blue-700 underline hover:text-blue-900"
              >
                Ver saldo global deste cliente (Conta corrente)
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <SearchableSelect
              label="Cliente"
              value={clienteId}
              onChange={setClienteId}
              loadOptions={loadClienteOptions}
              loadLabelById={loadClienteLabelById}
              minChars={0}
              placeholder="Todos os clientes"
              emptyHint="Digite para buscar ou deixe em branco para todos."
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Nº venda (ordem)</label>
            <input
              type="text"
              inputMode="numeric"
              value={vendaIdFiltro}
              onChange={(e) => setVendaIdFiltro(e.target.value)}
              className="input-field font-mono"
              placeholder="ex: 1840"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-field"
            >
              <option value="">Todos</option>
              <option value="aberto">Aberto</option>
              <option value="parcial">Parcial</option>
              <option value="quitado">Quitado</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Venc. início</label>
            <input
              type="date"
              value={dataVencInicio}
              onChange={(e) => setDataVencInicio(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Venc. fim</label>
            <input
              type="date"
              value={dataVencFim}
              onChange={(e) => setDataVencFim(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="md:col-span-1 flex items-end">
            <button onClick={carregar} className="btn-primary w-full">
              Filtrar
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={somenteEmAberto}
              onChange={(e) => setSomenteEmAberto(e.target.checked)}
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
          <button onClick={exportarCsv} className="btn-secondary ml-auto">
            Exportar CSV
          </button>
          <button onClick={exportarExcel} className="btn-secondary">
            Exportar Excel
          </button>
        </div>
      </div>

      {dados && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-500">Títulos</p>
            <p className="font-bold">{dados.resumo.totalTitulos}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-500">Em Aberto</p>
            <p className="font-bold text-red-600">
              {formatMoney(dados.resumo.valorEmAberto)}
            </p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-500">Vencidos</p>
            <p className="font-bold text-red-700">
              {formatMoney(dados.resumo.faixas.vencidos)}
            </p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-500">0-30 dias</p>
            <p className="font-bold">{formatMoney(dados.resumo.faixas.ate30)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-500">31-60</p>
            <p className="font-bold">{formatMoney(dados.resumo.faixas.de31a60)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-500">61-90</p>
            <p className="font-bold">{formatMoney(dados.resumo.faixas.de61a90)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-gray-500">90+</p>
            <p className="font-bold">{formatMoney(dados.resumo.faixas.acima90)}</p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableListSkeleton rows={12} cols={6} />
          </div>
        ) : !dados || dados.titulos.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Nenhum título encontrado
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Título</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Venda</th>
                <th className="table-header">Vencimento</th>
                <th className="table-header text-right">Original</th>
                <th className="table-header text-right">Pago</th>
                <th className="table-header text-right">Aberto</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {titulosOrdenados.map((t) => {
                const aberto = Math.max(
                  0,
                  parseFloat(String(t.valorOriginal)) - parseFloat(String(t.valorPago)),
                );
                const diasAtraso = getDiasAtraso(t.vencimento, aberto);
                return (
                  <tr key={t.id} className="table-row">
                    <td className="table-cell font-mono">
                      {t.numero || `#${t.id}`}
                    </td>
                    <td className="table-cell">
                      <Link
                        href={`/clientes/${t.cliente.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {t.cliente.nomeFantasia || t.cliente.razaoSocial}
                      </Link>
                      <div>
                        <Link
                          href={`/clientes/${t.cliente.id}`}
                          className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
                        >
                          Cobrar cliente
                        </Link>
                      </div>
                    </td>
                    <td className="table-cell">
                      {t.venda ? (
                        <Link
                          href={`/vendas/${t.venda.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          Venda #{t.venda.id}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="table-cell">{formatDate(t.vencimento)}</td>
                    <td className="table-cell text-right">
                      {formatMoney(t.valorOriginal)}
                    </td>
                    <td className="table-cell text-right">
                      {formatMoney(t.valorPago)}
                    </td>
                    <td className="table-cell text-right font-semibold text-red-600">
                      {formatMoney(aberto)}
                      {diasAtraso > 0 && (
                        <div className="text-xs text-red-500">{diasAtraso} dias</div>
                      )}
                    </td>
                    <td className="table-cell">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          t.status === "quitado"
                            ? "bg-green-100 text-green-700"
                            : t.status === "parcial"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function RelatorioTitulosPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 max-w-7xl mx-auto">
          <TableListSkeleton />
        </div>
      }
    >
      <RelatorioTitulosContent />
    </Suspense>
  );
}
