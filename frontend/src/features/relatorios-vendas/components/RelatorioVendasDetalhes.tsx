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
  vendas: Venda[];
  onExportPdfSecao: (secao: RelatorioVendasPdfSecao) => void;
};

export function RelatorioVendasDetalhes({ vendas, onExportPdfSecao }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
        <h3 className="font-semibold">Detalhamento das Vendas</h3>
        <RelatorioPdfSecaoButton onClick={() => onExportPdfSecao("detalhes")} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="table-header w-24 bg-slate-50">Ordem</th>
              <th className="table-header">Data</th>
              <th className="table-header">Cliente</th>
              <th className="table-header">Vendedor</th>
              <th className="table-header text-right">Frete</th>
              <th className="table-header">Frete pago</th>
              <th className="table-header text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {vendas.map((v) => (
              <tr key={v.id} className="table-row">
                <VendaOrdemCell venda={v} />
                <td className="table-cell">{formatDate(v.dataVenda)}</td>
                <td className="table-cell font-medium">
                  {v.cliente.nomeFantasia || v.cliente.razaoSocial}
                </td>
                <td className="table-cell">{v.vendedor.nome}</td>
                <td className="table-cell text-right">{formatMoney(v.frete)}</td>
                <td className="table-cell text-xs text-gray-600 max-w-[11rem]">
                  {formatFreteReciboLinha(v)}
                </td>
                <td className="table-cell text-right font-semibold">
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
