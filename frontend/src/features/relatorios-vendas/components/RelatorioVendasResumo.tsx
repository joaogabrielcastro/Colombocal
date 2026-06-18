"use client";

import { formatMoney } from "@/lib/utils";
import type {
  ResumoCliente,
  ResumoProduto,
  ResumoRepresentante,
  SortRepKey,
} from "../services/resumo";
import type { RelatorioVendasPdfSecao } from "../services/exports";
import { RelatorioPdfSecaoButton } from "./RelatorioPdfSecaoButton";

type Props = {
  totalRegistros: number;
  totalFaturamento: number;
  totalFrete: number;
  resumoRepresentantesOrdenado: ResumoRepresentante[];
  resumoClientes: ResumoCliente[];
  resumoProdutos: ResumoProduto[];
  onSortRep: (key: SortRepKey) => void;
  sortIndicator: (key: SortRepKey) => string;
  onExportPdfSecao: (secao: RelatorioVendasPdfSecao) => void;
};

function SecaoHeader({
  title,
  secao,
  onExportPdfSecao,
}: {
  title: string;
  secao: RelatorioVendasPdfSecao;
  onExportPdfSecao: (s: RelatorioVendasPdfSecao) => void;
}) {
  return (
    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
      <h3 className="font-semibold">{title}</h3>
      <RelatorioPdfSecaoButton onClick={() => onExportPdfSecao(secao)} />
    </div>
  );
}

export function RelatorioVendasResumo({
  totalRegistros,
  totalFaturamento,
  totalFrete,
  resumoRepresentantesOrdenado,
  resumoClientes,
  resumoProdutos,
  onSortRep,
  sortIndicator,
  onExportPdfSecao,
}: Props) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-2 print:hidden">
        <p className="text-sm text-gray-500">Totais do período</p>
        <RelatorioPdfSecaoButton
          label="PDF resumo"
          onClick={() => onExportPdfSecao("totais")}
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-sm text-gray-500">Vendas no período</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{totalRegistros}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-sm text-gray-500">Total vendido (período)</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{formatMoney(totalFaturamento)}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-sm text-gray-500">Frete total</p>
          <p className="text-3xl font-bold text-indigo-700 mt-1">{formatMoney(totalFrete)}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-sm text-gray-500">Ticket médio</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">
            {totalRegistros > 0 ? formatMoney(totalFaturamento / totalRegistros) : "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="card overflow-hidden">
          <SecaoHeader
            title="Por Representante (Completo)"
            secao="representantes"
            onExportPdfSecao={onExportPdfSecao}
          />
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header"><button type="button" onClick={() => onSortRep("nome")} className="hover:underline">Representante{sortIndicator("nome")}</button></th>
                <th className="table-header text-right"><button type="button" onClick={() => onSortRep("quantidade")} className="hover:underline">Qtd{sortIndicator("quantidade")}</button></th>
                <th className="table-header text-right"><button type="button" onClick={() => onSortRep("participacao")} className="hover:underline">Part. %{sortIndicator("participacao")}</button></th>
                <th className="table-header text-right"><button type="button" onClick={() => onSortRep("total")} className="hover:underline">Total{sortIndicator("total")}</button></th>
              </tr>
            </thead>
            <tbody>
              {resumoRepresentantesOrdenado.map((r, i) => (
                <tr key={i} className="table-row">
                  <td className="table-cell font-medium">{r.nome}</td>
                  <td className="table-cell text-right text-gray-500">{r.quantidade}</td>
                  <td className="table-cell text-right text-gray-500">{r.participacao.toFixed(2)}%</td>
                  <td className="table-cell text-right font-semibold">{formatMoney(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <SecaoHeader title="Por Cliente" secao="clientes" onExportPdfSecao={onExportPdfSecao} />
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Cliente</th>
                <th className="table-header text-right">Qtd</th>
                <th className="table-header text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {resumoClientes.map((c, i) => (
                <tr key={i} className="table-row">
                  <td className="table-cell font-medium">{c.nome}</td>
                  <td className="table-cell text-right text-gray-500">{c.quantidade}</td>
                  <td className="table-cell text-right font-semibold">{formatMoney(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <SecaoHeader title="Por Produto" secao="produtos" onExportPdfSecao={onExportPdfSecao} />
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Produto</th>
                <th className="table-header text-right">Quantidade</th>
                <th className="table-header text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {resumoProdutos.map((p, i) => (
                <tr key={i} className="table-row">
                  <td className="table-cell font-medium">{p.nome}</td>
                  <td className="table-cell text-right text-gray-500">{p.quantidade.toLocaleString("pt-BR")} {p.unidade}</td>
                  <td className="table-cell text-right font-semibold">{formatMoney(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
