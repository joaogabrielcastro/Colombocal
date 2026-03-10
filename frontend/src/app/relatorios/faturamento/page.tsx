'use client';
import { useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatMoney } from '@/lib/utils';
import api from '@/lib/api';

interface FaturamentoData {
  totalGeral: number;
  quantidadeVendas: number;
  porCliente: { clienteId: number; nomeCliente: string; total: number; quantidade: number }[];
  porProduto: { produtoId: number; nomeProduto: string; total: number; quantidade: number }[];
  porMes: { mes: string; total: number; quantidade: number }[];
}

export default function FaturamentoPage() {
  const [dados, setDados] = useState<FaturamentoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [aba, setAba] = useState<'cliente' | 'produto' | 'mes'>('cliente');

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
    api.get<FaturamentoData>(`/relatorios/faturamento?${params}`).then(setDados).finally(() => setLoading(false));
  };

  const maxTotal = (arr: { total: number }[]) => Math.max(...arr.map(i => i.total), 1);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Relatório de Faturamento</h1>
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
              <MagnifyingGlassIcon className="w-4 h-4" /> Gerar
            </button>
          </div>
        </div>
      </div>

      {loading && <div className="text-center text-gray-400 py-8">Carregando...</div>}

      {!loading && dados && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Faturamento Total</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{formatMoney(dados.totalGeral)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Quantidade de Vendas</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{dados.quantidadeVendas}</p>
              {dados.quantidadeVendas > 0 && (
                <p className="text-xs text-gray-400 mt-1">ticket médio {formatMoney(dados.totalGeral / dados.quantidadeVendas)}</p>
              )}
            </div>
          </div>

          {/* Abas */}
          <div className="flex gap-1 mb-4 border-b border-gray-200">
            {(['cliente', 'produto', 'mes'] as const).map(t => (
              <button
                key={t}
                onClick={() => setAba(t)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${aba === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {t === 'mes' ? 'Por Mês' : t === 'cliente' ? 'Por Cliente' : 'Por Produto'}
              </button>
            ))}
          </div>

          {aba === 'cliente' && (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Cliente</th>
                    <th className="table-header text-right">Vendas</th>
                    <th className="table-header text-right">Total</th>
                    <th className="table-header">%</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porCliente.map(c => (
                    <tr key={c.clienteId} className="table-row">
                      <td className="table-cell">{c.nomeCliente}</td>
                      <td className="table-cell text-right">{c.quantidade}</td>
                      <td className="table-cell text-right font-semibold">{formatMoney(c.total)}</td>
                      <td className="table-cell w-32">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${(c.total / maxTotal(dados.porCliente)) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-9 text-right">
                            {dados.totalGeral > 0 ? ((c.total / dados.totalGeral) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {aba === 'produto' && (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Produto</th>
                    <th className="table-header text-right">Qtde Vendida</th>
                    <th className="table-header text-right">Total</th>
                    <th className="table-header">%</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porProduto.map(p => (
                    <tr key={p.produtoId} className="table-row">
                      <td className="table-cell">{p.nomeProduto}</td>
                      <td className="table-cell text-right">{p.quantidade}</td>
                      <td className="table-cell text-right font-semibold">{formatMoney(p.total)}</td>
                      <td className="table-cell w-32">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${(p.total / maxTotal(dados.porProduto)) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-9 text-right">
                            {dados.totalGeral > 0 ? ((p.total / dados.totalGeral) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {aba === 'mes' && (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Mês</th>
                    <th className="table-header text-right">Vendas</th>
                    <th className="table-header text-right">Total</th>
                    <th className="table-header">Barra</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porMes.map(m => (
                    <tr key={m.mes} className="table-row">
                      <td className="table-cell font-medium">{m.mes}</td>
                      <td className="table-cell text-right">{m.quantidade}</td>
                      <td className="table-cell text-right font-semibold">{formatMoney(m.total)}</td>
                      <td className="table-cell w-48">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-3">
                            <div
                              className="bg-orange-400 h-3 rounded-full"
                              style={{ width: `${(m.total / maxTotal(dados.porMes)) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
