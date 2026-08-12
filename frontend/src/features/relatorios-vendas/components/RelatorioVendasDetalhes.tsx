"use client";

import {
  formatDate,
  formatFreteReciboLinha,
  formatMoney,
  type Venda,
} from "@/lib/utils";
import { VendaOrdemCell } from "@/components/VendaOrdem";
import type { RelatorioVendasPdfSecao } from "../services/exports";
import { RelatorioPdfSecaoButton } from "./RelatorioPdfSecaoButton";

type Props = {
  freteEnabled?: boolean;
  vendas: Venda[];
  onExportPdfSecao: (secao: RelatorioVendasPdfSecao) => void;
};

export function RelatorioVendasDetalhes({ freteEnabled = true, vendas, onExportPdfSecao }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900">Detalhamento das Vendas</h3>
        <RelatorioPdfSecaoButton onClick={() => onExportPdfSecao("detalhes")} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-gray-200 bg-slate-50/80">
              <th className="table-header text-left px-4 py-3 w-28">Ordem</th>
              <th className="table-header text-left px-4 py-3">Data</th>
              <th className="table-header text-left px-4 py-3 min-w-[200px] w-[28%]">
                Cliente
              </th>
              <th className="table-header text-left px-4 py-3">Vendedor</th>
              {freteEnabled ? (
                <>
                  <th className="table-header text-right px-4 py-3">Frete</th>
                  <th className="table-header text-left px-4 py-3">Frete pago</th>
                </>
              ) : null}
              <th className="table-header text-right px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {vendas.map((v) => (
              <tr key={v.id} className="table-row">
                <VendaOrdemCell venda={v} />
                <td className="table-cell px-4 py-3">{formatDate(v.dataVenda)}</td>
                <td className="table-cell px-4 py-3 font-medium">
                  {v.cliente.nomeFantasia || v.cliente.razaoSocial}
                </td>
                <td className="table-cell px-4 py-3">{v.vendedor.nome}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
