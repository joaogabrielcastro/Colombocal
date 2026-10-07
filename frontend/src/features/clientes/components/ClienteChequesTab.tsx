import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/utils";
import { VendaOrdem } from "@/components/VendaOrdem";
import type { Cheque } from "@/features/clientes/types";
import { EmptyState } from "@/components/ui/empty-state";

type Props = {
  clienteId: string;
  cheques: Cheque[];
  filtroChqIni: string; filtroChqFim: string; buscaChq: string;
  setFiltroChqIni: (value: string) => void; setFiltroChqFim: (value: string) => void;
  setBuscaChq: (value: string) => void; onFiltrar: () => void;
};

export function ClienteChequesTab({ clienteId, cheques, filtroChqIni, filtroChqFim, buscaChq, setFiltroChqIni, setFiltroChqFim, setBuscaChq, onFiltrar }: Props) {
  const filtrados = cheques.filter((c) => {
    const q = buscaChq.trim().toLowerCase();
    return !q || (c.banco && c.banco.toLowerCase().includes(q)) || (c.numero && c.numero.toLowerCase().includes(q)) || String(c.numeroOrdem).includes(q);
  });
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">Cheques do Cliente</h3>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
            Cheque registrado abate o saldo na hora. Não há depósito/compensação nesta versão —
            para corrigir dados, estorne e registre de novo.
          </p>
        </div>
        <Link href={`/financeiro/novo?clienteId=${clienteId}`} className="btn-primary text-sm">+ Receber pagamento</Link>
      </div>
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1" htmlFor="cli-chq-de">De</label>
          <input id="cli-chq-de" type="date" value={filtroChqIni} onChange={(e) => setFiltroChqIni(e.target.value)} className="input-field text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1" htmlFor="cli-chq-ate">Até</label>
          <input id="cli-chq-ate" type="date" value={filtroChqFim} onChange={(e) => setFiltroChqFim(e.target.value)} className="input-field text-sm" />
        </div>
        <button type="button" onClick={onFiltrar} className="btn-primary text-sm">Filtrar</button>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1" htmlFor="cli-chq-busca">Busca (banco, nº cheque, ordem)</label>
          <input id="cli-chq-busca" value={buscaChq} onChange={(e) => setBuscaChq(e.target.value)} className="input-field text-sm" placeholder="Filtra na lista carregada..." />
        </div>
      </div>
      {cheques.length === 0 ? <div className="p-4"><EmptyState compact title="Nenhum cheque registrado" /></div>
        : filtrados.length === 0 ? <div className="p-4"><EmptyState compact title="Nenhum cheque com os filtros atuais" description="Ajuste o período ou a busca." /></div>
          : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-200">
            <th className="table-header w-16">Ordem</th><th className="table-header">Banco / Nº</th><th className="table-header w-28 bg-slate-50">Ordem</th><th className="table-header">Valor</th><th className="table-header">Data</th>
          </tr></thead><tbody>{filtrados.map((c) => <tr key={c.id} className="table-row">
            <td className="table-cell font-mono font-bold text-gray-600">#{c.numeroOrdem}</td>
            <td className="table-cell"><p className="font-medium">{c.banco || "-"}</p>{c.numero && <p className="text-xs text-gray-400">Nº {c.numero}</p>}</td>
            <td className="table-cell">{c.venda ? <VendaOrdem venda={c.venda} size="sm" prefix="Venda" /> : <span className="text-gray-400 text-sm">-</span>}</td>
            <td className="table-cell font-semibold">{formatMoney(c.valor)}</td><td className="table-cell">{formatDate(c.dataRecebimento)}</td>
          </tr>)}</tbody></table></div>}
    </div>
  );
}
