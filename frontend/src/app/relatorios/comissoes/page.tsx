'use client';
import { useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatMoney, formatDate } from '@/lib/utils';
import api from '@/lib/api';

interface ComissaoVendedor {
  vendedor: { id: number; nome: string; comissaoPercentual: number };
  vendas: any[];
  totalVendas: number;
  comissao: number;
  percentual: number;
  quantidadeVendas: number;
}

export default function ComissoesPage() {
  const [dados, setDados] = useState<ComissaoVendedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [expandido, setExpandido] = useState<number | null>(null);

  useEffect(() => {
    const hoje = new Date();
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const fim = hoje.toISOString().split('T')[0];
    setDataInicio(ini);
    setDataFim(fim);
    buscar(ini, fim);
  }, []);

  const buscar = (ini?: string, fim?: string) => {
    const params = new URLSearchParams();
    if (ini ?? dataInicio) params.set('dataInicio', ini ?? dataInicio);
    if (fim ?? dataFim) params.set('dataFim', fim ?? dataFim);
    setLoading(true);
    api.get<ComissaoVendedor[]>(`/relatorios/comissoes?${params}`).then(setDados).finally(() => setLoading(false));
  };

  const totalComissao = dados.reduce((acc, d) => acc + d.comissao, 0);
  const totalVendas = dados.reduce((acc, d) => acc + d.totalVendas, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Comissões por Vendedor</h1>
      </div>

      <div className="card p-4 mb-6">
        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data Início</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data Fim</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="input-field" />
          </div>
          <div className="flex items-end">
            <button onClick={() => buscar()} className="btn-primary">
              <MagnifyingGlassIcon className="w-4 h-4" /> Calcular
            </button>
          </div>
        </div>
      </div>

      {loading && <div className="text-center text-gray-400 py-8">Calculando...</div>}

      {!loading && dados.length > 0 && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Total em Vendas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatMoney(totalVendas)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Total em Comissões</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{formatMoney(totalComissao)}</p>
            </div>
          </div>

          {/* Por vendedor */}
          {dados.map(d => (
            <div key={d.vendedor.id} className="card mb-3 overflow-hidden">
              <button
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                onClick={() => setExpandido(expandido === d.vendedor.id ? null : d.vendedor.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{d.vendedor.nome}</p>
                    <p className="text-xs text-gray-400">{d.quantidadeVendas} vendas • comissão: {d.percentual.toFixed(2)}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Vendas</p>
                    <p className="font-semibold">{formatMoney(d.totalVendas)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Comissão</p>
                    <p className="font-bold text-orange-600">{formatMoney(d.comissao)}</p>
                  </div>
                </div>
              </button>
              {expandido === d.vendedor.id && d.vendas.length > 0 && (
                <div className="border-t border-gray-100">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="table-header">#</th>
                        <th className="table-header">Data</th>
                        <th className="table-header">Cliente</th>
                        <th className="table-header text-right">Total</th>
                        <th className="table-header text-right">Comissão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.vendas.map((v: any) => (
                        <tr key={v.id} className="table-row bg-gray-50">
                          <td className="table-cell text-gray-400">#{v.id}</td>
                          <td className="table-cell">{formatDate(v.dataVenda)}</td>
                          <td className="table-cell">{v.cliente.nomeFantasia || v.cliente.razaoSocial}</td>
                          <td className="table-cell text-right">{formatMoney(v.valorTotal)}</td>
                          <td className="table-cell text-right text-orange-600">
                            {formatMoney(parseFloat(String(v.valorTotal)) * d.percentual / 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
