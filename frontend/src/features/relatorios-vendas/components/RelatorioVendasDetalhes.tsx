"use client";

import { useMemo, useState } from "react";
import {
  formatDate,
  formatFreteReciboLinha,
  formatMoney,
  vendaNumeroPublico,
  type Venda,
} from "@/lib/utils";
import { VendaOrdemCell } from "@/components/VendaOrdem";
import type { RelatorioVendasPdfSecao } from "../services/exports";
import { RelatorioPdfSecaoButton } from "./RelatorioPdfSecaoButton";
import { EXPORT_MAX_ROWS } from "../hooks/useRelatorioVendasQuery";
import {
  formatVendaProdutos,
  formatVendaQuantidades,
  textoObservacao,
} from "../services/detalheVenda";

type Props = {
  freteEnabled?: boolean;
  vendas: Venda[];
  totalRegistros?: number;
  onExportPdfSecao: (secao: RelatorioVendasPdfSecao) => void;
};

const PAGE_SIZE = 20;

type SortKey = "data" | "ordem" | "cliente" | "representante" | "total";

function compareVendas(a: Venda, b: Venda, key: SortKey, dir: "asc" | "desc") {
  const mul = dir === "asc" ? 1 : -1;
  if (key === "ordem") return (vendaNumeroPublico(a) - vendaNumeroPublico(b)) * mul;
  if (key === "total") return (parseFloat(String(a.valorTotal)) - parseFloat(String(b.valorTotal))) * mul;
  if (key === "cliente") {
    const na = a.cliente.nomeFantasia || a.cliente.razaoSocial;
    const nb = b.cliente.nomeFantasia || b.cliente.razaoSocial;
    return na.localeCompare(nb, "pt-BR") * mul;
  }
  if (key === "representante") return a.vendedor.nome.localeCompare(b.vendedor.nome, "pt-BR") * mul;
  return (new Date(a.dataVenda).getTime() - new Date(b.dataVenda).getTime()) * mul;
}

export function RelatorioVendasDetalhes({
  freteEnabled = true,
  vendas,
  totalRegistros,
  onExportPdfSecao,
}: Props) {
  const [buscaLocal, setBuscaLocal] = useState("");
  const [pagina, setPagina] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "data",
    dir: "desc",
  });

  const filtradas = useMemo(() => {
    const term = buscaLocal.trim().toLowerCase();
    const base = !term
      ? vendas
      : vendas.filter((v) => {
          const cliente = (v.cliente.nomeFantasia || v.cliente.razaoSocial || "").toLowerCase();
          const obs = String(v.observacoes || "").toLowerCase();
          const ordem = String(vendaNumeroPublico(v));
          const prod = formatVendaProdutos(v).toLowerCase();
          return (
            cliente.includes(term) ||
            obs.includes(term) ||
            ordem.includes(term) ||
            prod.includes(term)
          );
        });
    return [...base].sort((a, b) => compareVendas(a, b, sort.key, sort.dir));
  }, [vendas, buscaLocal, sort]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * PAGE_SIZE;
  const paginaVendas = filtradas.slice(inicio, inicio + PAGE_SIZE);
  const truncado = totalRegistros != null && totalRegistros > vendas.length;

  const toggleSort = (key: SortKey) => {
    setPagina(1);
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "cliente" || key === "representante" ? "asc" : "desc" },
    );
  };

  const sortMark = (key: SortKey) => (sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div className="card overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Detalhamento das Vendas</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {truncado
              ? `Exibindo ${vendas.length} de ${totalRegistros} vendas na tela (limite da consulta). PDF e Excel incluem até ${EXPORT_MAX_ROWS.toLocaleString("pt-BR")} registros.`
              : `${vendas.length} venda(s) no período filtrado`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={buscaLocal}
            onChange={(e) => {
              setBuscaLocal(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar nesta lista"
            className="input-field h-9 w-full sm:w-56"
            aria-label="Buscar no detalhamento"
          />
          <RelatorioPdfSecaoButton onClick={() => onExportPdfSecao("detalhes")} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="border-b border-gray-200 bg-slate-50/80">
              <th className="table-header text-left px-4 py-3">
                <button type="button" className="hover:underline" onClick={() => toggleSort("data")}>
                  Data{sortMark("data")}
                </button>
              </th>
              <th className="table-header text-left px-4 py-3 w-28">
                <button type="button" className="hover:underline" onClick={() => toggleSort("ordem")}>
                  Nº{sortMark("ordem")}
                </button>
              </th>
              <th className="table-header text-left px-4 py-3 min-w-[180px] w-[22%]">
                <button type="button" className="hover:underline" onClick={() => toggleSort("cliente")}>
                  Cliente{sortMark("cliente")}
                </button>
              </th>
              <th className="table-header text-left px-4 py-3 min-w-[140px]">Produto</th>
              <th className="table-header text-left px-4 py-3">
                <button type="button" className="hover:underline" onClick={() => toggleSort("representante")}>
                  Representante{sortMark("representante")}
                </button>
              </th>
              <th className="table-header text-left px-4 py-3">Motorista</th>
              <th className="table-header text-right px-4 py-3">Quantidade</th>
              {freteEnabled ? (
                <>
                  <th className="table-header text-right px-4 py-3">Frete</th>
                  <th className="table-header text-left px-4 py-3">Frete pago</th>
                </>
              ) : null}
              <th className="table-header text-right px-4 py-3">
                <button type="button" className="hover:underline" onClick={() => toggleSort("total")}>
                  Total{sortMark("total")}
                </button>
              </th>
              <th className="table-header text-left px-4 py-3 min-w-[8rem]">Observação</th>
            </tr>
          </thead>
          <tbody>
            {paginaVendas.length === 0 ? (
              <tr>
                <td
                  colSpan={freteEnabled ? 11 : 9}
                  className="px-4 py-10 text-center text-sm text-gray-500"
                >
                  Nenhuma venda nesta lista corresponde à busca.
                </td>
              </tr>
            ) : (
              paginaVendas.map((v) => (
                <tr key={v.id} className="table-row">
                  <td className="table-cell px-4 py-3 whitespace-nowrap">{formatDate(v.dataVenda)}</td>
                  <VendaOrdemCell venda={v} />
                  <td className="table-cell px-4 py-3 font-medium">
                    {v.cliente.nomeFantasia || v.cliente.razaoSocial}
                  </td>
                  <td className="table-cell px-4 py-3 text-gray-700">
                    <span className="line-clamp-2" title={formatVendaProdutos(v)}>
                      {formatVendaProdutos(v)}
                    </span>
                  </td>
                  <td className="table-cell px-4 py-3">{v.vendedor.nome}</td>
                  <td className="table-cell px-4 py-3 text-gray-600">{v.motorista?.nome || "—"}</td>
                  <td className="table-cell text-right px-4 py-3 text-gray-700 tabular-nums whitespace-nowrap">
                    {formatVendaQuantidades(v)}
                  </td>
                  {freteEnabled ? (
                    <>
                      <td className="table-cell text-right px-4 py-3 tabular-nums">
                        {formatMoney(v.frete)}
                      </td>
                      <td className="table-cell px-4 py-3 text-xs text-gray-600 max-w-[14rem]">
                        {formatFreteReciboLinha(v)}
                      </td>
                    </>
                  ) : null}
                  <td className="table-cell text-right px-4 py-3 font-semibold tabular-nums">
                    {formatMoney(v.valorTotal)}
                  </td>
                  <td className="table-cell px-4 py-3 text-gray-600 text-xs max-w-[12rem]">
                    <span className="line-clamp-2" title={textoObservacao(v)}>
                      {textoObservacao(v)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {filtradas.length > PAGE_SIZE ? (
        <div className="px-4 sm:px-5 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>
            {inicio + 1}–{Math.min(inicio + PAGE_SIZE, filtradas.length)} de {filtradas.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary h-9"
              disabled={paginaAtual <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn-secondary h-9"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            >
              Próxima
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
