'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatMoney, formatDate, type Venda } from '@/lib/utils';
import api from '@/lib/api';

export default function VendasPage() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [clienteId, setClienteId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const carregar = () => {
    const params = new URLSearchParams();
    if (clienteId) params.set('clienteId', clienteId);
    if (dataInicio) params.set('dataInicio', dataInicio);
    if (dataFim) params.set('dataFim', dataFim);
    setLoading(true);
    api.get<Venda[]>(`/vendas?${params}`).then(setVendas).finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const totalFaturamento = vendas.reduce((acc, v) => acc + parseFloat(String(v.valorTotal)), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendas</h1>
          <p className="text-gray-500 text-sm mt-1">{vendas.length} vendas • Total: {formatMoney(totalFaturamento)}</p>
        </div>
        <Link href="/vendas/nova" className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Nova Venda
        </Link>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-32">
            <label className="block text-xs text-gray-500 mb-1">Data Início</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="input-field" />
          </div>
          <div className="flex-1 min-w-32">
            <label className="block text-xs text-gray-500 mb-1">Data Fim</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="input-field" />
          </div>
          <div className="flex items-end">
            <button onClick={carregar} className="btn-primary">
              <MagnifyingGlassIcon className="w-4 h-4" /> Filtrar
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : vendas.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhuma venda encontrada</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">#</th>
                <th className="table-header">Data</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Vendedor</th>
                <th className="table-header">Motorista</th>
                <th className="table-header">Itens</th>
                <th className="table-header">Frete</th>
                <th className="table-header">Total</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {vendas.map(v => (
                <tr key={v.id} className="table-row">
                  <td className="table-cell text-gray-400 font-mono">#{v.id}</td>
                  <td className="table-cell">{formatDate(v.dataVenda)}</td>
                  <td className="table-cell">
                    <p className="font-medium">{v.cliente.nomeFantasia || v.cliente.razaoSocial}</p>
                    <p className="text-xs text-gray-400">{v.cliente.cidade}</p>
                  </td>
                  <td className="table-cell">{v.vendedor.nome}</td>
                  <td className="table-cell">{v.motorista?.nome || '-'}</td>
                  <td className="table-cell text-center">{v.itens?.length || 0}</td>
                  <td className="table-cell">{formatMoney(v.frete)}</td>
                  <td className="table-cell font-semibold text-green-700">{formatMoney(v.valorTotal)}</td>
                  <td className="table-cell">
                    <Link href={`/vendas/${v.id}`} className="text-blue-600 hover:underline text-sm font-medium">Ver</Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td colSpan={7} className="px-4 py-3 text-sm font-semibold text-right text-gray-600">Total:</td>
                <td className="px-4 py-3 font-bold text-green-700">{formatMoney(totalFaturamento)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
