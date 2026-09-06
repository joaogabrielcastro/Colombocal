"use client";

import { formatMoney, formatQuantidade } from "@/lib/utils";
import type {
  ResumoCliente,
  ResumoClienteProduto,
  ResumoProduto,
  ResumoRepresentante,
  SortRepKey,
} from "../services/resumo";
import type { RelatorioVendasPdfSecao } from "../services/exports";
import { RelatorioPdfSecaoButton } from "./RelatorioPdfSecaoButton";

type Props = {
  freteEnabled?: boolean;
  totalRegistros: number;
  totalFaturamento: number;
  totalFrete: number;
  resumoRepresentantesOrdenado: ResumoRepresentante[];
  resumoClientes: ResumoCliente[];
  resumoProdutos: ResumoProduto[];
  resumoClienteProdutos: ResumoClienteProduto[];
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
    <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-2">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <RelatorioPdfSecaoButton onClick={() => onExportPdfSecao(secao)} />
    </div>
  );
}

export function RelatorioVendasResumo({
  freteEnabled = true,
  totalRegistros,
  totalFaturamento,
  totalFrete,
  resumoRepresentantesOrdenado,
  resumoClientes,
  resumoProdutos,
  resumoClienteProdutos,
  onSortRep,
  sortIndicator,
  onExportPdfSecao,
}: Props) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-3 print:hidden">
        <p className="text-sm text-gray-500">Totais do período</p>
        <RelatorioPdfSecaoButton
          label="PDF resumo"
          onClick={() => onExportPdfSecao("totais")}
        />
      </div>
      <div
        className={`grid gap-4 lg:gap-5 mb-6 ${
          freteEnabled
            ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
            : "grid-cols-1 sm:grid-cols-3"
        }`}
      >
        <div className="card p-5 sm:p-6">
          <p className="text-sm text-gray-500 mb-1">Vendas no período</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight tabular-nums">
            {totalRegistros}
          </p>
        </div>
        <div className="card p-5 sm:p-6">
          <p className="text-sm text-gray-500 mb-1">Total vendido (período)</p>
          <p className="text-2xl sm:text-3xl font-bold text-green-700 tracking-tight tabular-nums">
            {formatMoney(totalFaturamento)}
          </p>
        </div>
        {freteEnabled ? (
          <div className="card p-5 sm:p-6">
            <p className="text-sm text-gray-500 mb-1">Frete total</p>
            <p className="text-2xl sm:text-3xl font-bold text-indigo-700 tracking-tight tabular-nums">
              {formatMoney(totalFrete)}
            </p>
          </div>
        ) : null}
        <div className="card p-5 sm:p-6">
          <p className="text-sm text-gray-500 mb-1">Ticket médio</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600 tracking-tight tabular-nums">
            {totalRegistros > 0
              ? formatMoney(totalFaturamento / totalRegistros)
              : "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 lg:gap-5 mb-5">
        <div className="card overflow-hidden lg:col-span-2 2xl:col-span-1">
          <SecaoHeader
            title="Por Representante (Completo)"
            secao="representantes"
            onExportPdfSecao={onExportPdfSecao}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50/80">
                  <th className="table-header text-left px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSortRep("nome")}
                      className="hover:underline"
                    >
                      Representante{sortIndicator("nome")}
                    </button>
                  </th>
                  <th className="table-header text-right px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSortRep("quantidade")}
                      className="hover:underline"
                    >
                      Qtd{sortIndicator("quantidade")}
                    </button>
                  </th>
                  <th className="table-header text-right px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSortRep("participacao")}
                      className="hover:underline"
                    >
                      Part. %{sortIndicator("participacao")}
                    </button>
                  </th>
                  <th className="table-header text-right px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSortRep("total")}
                      className="hover:underline"
                    >
                      Total{sortIndicator("total")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {resumoRepresentantesOrdenado.map((r, i) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell px-4 py-3 font-medium">{r.nome}</td>
                    <td className="table-cell text-right px-4 py-3 text-gray-500 tabular-nums">
                      {r.quantidade}
                    </td>
                    <td className="table-cell text-right px-4 py-3 text-gray-500 tabular-nums">
                      {r.participacao.toFixed(2)}%
                    </td>
                    <td className="table-cell text-right px-4 py-3 font-semibold tabular-nums">
                      {formatMoney(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <SecaoHeader
            title="Por Cliente"
            secao="clientes"
            onExportPdfSecao={onExportPdfSecao}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px]">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50/80">
                  <th className="table-header text-left px-4 py-3">Cliente</th>
                  <th className="table-header text-right px-4 py-3">Qtd</th>
                  <th className="table-header text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {resumoClientes.map((c, i) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell px-4 py-3 font-medium">{c.nome}</td>
                    <td className="table-cell text-right px-4 py-3 text-gray-500 tabular-nums">
                      {c.quantidade}
                    </td>
                    <td className="table-cell text-right px-4 py-3 font-semibold tabular-nums">
                      {formatMoney(c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <SecaoHeader
            title="Por Produto"
            secao="produtos"
            onExportPdfSecao={onExportPdfSecao}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px]">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50/80">
                  <th className="table-header text-left px-4 py-3">Produto</th>
                  <th className="table-header text-right px-4 py-3">Quantidade</th>
                  <th className="table-header text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {resumoProdutos.map((p, i) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell px-4 py-3 font-medium">{p.nome}</td>
                    <td className="table-cell text-right px-4 py-3 text-gray-500 tabular-nums">
                      {p.quantidade.toLocaleString("pt-BR")} {p.unidade}
                    </td>
                    <td className="table-cell text-right px-4 py-3 font-semibold tabular-nums">
                      {formatMoney(p.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {resumoClienteProdutos.length > 0 ? (
        <div className="card overflow-hidden mb-5">
          <SecaoHeader
            title="Produtos por cliente"
            secao="clienteProdutos"
            onExportPdfSecao={onExportPdfSecao}
          />
          <p className="px-4 sm:px-5 pt-3 text-sm text-gray-500">
            Quanto cada cliente levou de cada produto no período (sacos, toneladas, etc.).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50/80">
                  <th className="table-header text-left px-4 py-3">Cliente</th>
                  <th className="table-header text-left px-4 py-3">Produto</th>
                  <th className="table-header text-right px-4 py-3">Quantidade</th>
                  <th className="table-header text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {resumoClienteProdutos.map((c) =>
                  c.produtos.map((p, pi) => (
                    <tr
                      key={`${c.nome}-${p.produtoNome}-${pi}`}
                      className={`table-row ${pi === 0 ? "border-t border-gray-200" : ""}`}
                    >
                      <td className="table-cell px-4 py-3 font-medium">
                        {pi === 0 ? c.nome : ""}
                      </td>
                      <td className="table-cell px-4 py-3">{p.produtoNome}</td>
                      <td className="table-cell text-right px-4 py-3 text-gray-700 tabular-nums">
                        {formatQuantidade(p.quantidade, p.unidade)}
                      </td>
                      <td className="table-cell text-right px-4 py-3 font-semibold tabular-nums">
                        {formatMoney(p.total)}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}
