import { formatMoney } from "@/lib/utils";
import type { Dispatch, SetStateAction } from "react";
import type { ProdutoPreco } from "@/features/clientes/types";

type Props = {
  produtos: ProdutoPreco[];
  precosEdit: Record<number, string>;
  setPrecosEdit: Dispatch<SetStateAction<Record<number, string>>>;
  salvando: boolean;
  onSalvar: () => void;
};

export function ClientePrecosTab({ produtos, precosEdit, setPrecosEdit, salvando, onSalvar }: Props) {
  return (
    <div className="card">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Preços especiais por produto</h3>
        <p className="text-gray-500 text-xs mt-0.5">Deixe em branco para usar o preço padrão do produto</p>
      </div>
      <table className="w-full">
        <thead><tr className="border-b border-gray-200">
          <th className="table-header">Produto</th><th className="table-header">Unidade</th>
          <th className="table-header">Preço Padrão</th><th className="table-header">Preço Especial</th>
        </tr></thead>
        <tbody>{produtos.map((p) => (
          <tr key={p.id} className="table-row">
            <td className="table-cell font-medium">{p.nome}</td>
            <td className="table-cell text-gray-500">{p.unidade}</td>
            <td className="table-cell">{formatMoney(p.precoPadrao)}</td>
            <td className="table-cell"><input type="number" step="0.01" min="0" placeholder={formatMoney(p.precoPadrao)} value={precosEdit[p.id] || ""} onChange={(e) => setPrecosEdit((prev) => ({ ...prev, [p.id]: e.target.value }))} className="input-field w-36" /></td>
          </tr>
        ))}</tbody>
      </table>
      <div className="px-5 py-4 border-t border-gray-100">
        <button type="button" onClick={onSalvar} disabled={salvando} className="btn-primary">{salvando ? "Salvando..." : "Salvar Preços"}</button>
      </div>
    </div>
  );
}
