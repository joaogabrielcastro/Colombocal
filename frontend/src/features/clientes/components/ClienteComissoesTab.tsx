import type { Dispatch, SetStateAction } from "react";
import type { ComissoesData } from "@/features/clientes/types";

type Props = {
  comissoesData: ComissoesData | null;
  comissoesEdit: Record<number, string>;
  setComissoesEdit: Dispatch<SetStateAction<Record<number, string>>>;
  salvando: boolean;
  onSalvar: () => void;
};

export function ClienteComissoesTab({ comissoesData, comissoesEdit, setComissoesEdit, salvando, onSalvar }: Props) {
  if (!comissoesData) return <div className="card p-8 text-center text-gray-400 text-sm">Carregando comissões...</div>;
  return (
    <div className="card">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Comissões por produto</h3>
        <p className="text-gray-500 text-xs mt-0.5">
          {comissoesData.vendedor ? <>Representante: <strong>{comissoesData.vendedor.nome}</strong>{" · "}Padrão: <strong>{comissoesData.comissaoPadrao.toFixed(2)}%</strong>{comissoesData.comissaoFixaPercentual != null ? " (comissão fixa do cliente)" : " (% do representante)"}</> : <>Defina um representante no cadastro do cliente para usar o padrão.</>}
        </p>
        <p className="text-gray-400 text-xs mt-1">Deixe em branco para usar a comissão padrão do cliente/representante</p>
      </div>
      <table className="w-full">
        <thead><tr className="border-b border-gray-200">
          <th className="table-header">Produto</th><th className="table-header">Unidade</th><th className="table-header">Padrão (%)</th><th className="table-header">Comissão específica (%)</th><th className="table-header">Aplicada (%)</th>
        </tr></thead>
        <tbody>{comissoesData.produtos.map((p) => {
          const editVal = comissoesEdit[p.id] ?? "";
          const aplicada = editVal !== "" ? parseFloat(editVal.replace(",", ".")) || comissoesData.comissaoPadrao : p.comissaoAplicada;
          return <tr key={p.id} className="table-row">
            <td className="table-cell font-medium">{p.nome}</td><td className="table-cell text-gray-500">{p.unidade}</td>
            <td className="table-cell">{comissoesData.comissaoPadrao.toFixed(2)}%</td>
            <td className="table-cell"><input type="number" step="0.01" min="0" max="100" placeholder={comissoesData.comissaoPadrao.toFixed(2)} value={editVal} onChange={(e) => setComissoesEdit((prev) => ({ ...prev, [p.id]: e.target.value }))} className="input-field w-28" /></td>
            <td className="table-cell text-gray-600">{Number.isFinite(aplicada) ? `${aplicada.toFixed(2)}%` : "—"}</td>
          </tr>;
        })}</tbody>
      </table>
      <div className="px-5 py-4 border-t border-gray-100">
        <button type="button" onClick={onSalvar} disabled={salvando} className="btn-primary">{salvando ? "Salvando..." : "Salvar Comissões"}</button>
      </div>
    </div>
  );
}
