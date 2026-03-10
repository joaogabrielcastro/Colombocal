'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { formatMoney, type Produto } from '@/lib/utils';
import api from '@/lib/api';

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<null | Produto>(null);
  const [form, setForm] = useState<Partial<Produto>>({});
  const [salvando, setSalvando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = () => {
    api.get<Produto[]>('/produtos?ativo=true').then(setProdutos).finally(() => setLoading(false));
  };
  useEffect(() => { carregar(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      if (editando) {
        await api.put(`/produtos/${editando.id}`, form);
      } else {
        await api.post('/produtos', form);
      }
      setMostrarForm(false);
      setEditando(null);
      setForm({});
      carregar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (p: Produto) => {
    setEditando(p);
    setForm(p);
    setMostrarForm(true);
    setErro('');
  };

  const set = (field: keyof Produto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
          <p className="text-gray-500 text-sm mt-1">{produtos.length} produtos cadastrados</p>
        </div>
        <button
          onClick={() => { setMostrarForm(true); setEditando(null); setForm({ unidade: 'ton' }); setErro(''); }}
          className="btn-primary"
        >
          <PlusIcon className="w-4 h-4" />
          Novo Produto
        </button>
      </div>

      {/* Formulário modal */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">{editando ? 'Editar Produto' : 'Novo Produto'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-5">
              {erro && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input required value={form.nome || ''} onChange={set('nome')} className="input-field" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                    <input required value={form.codigo || ''} onChange={set('codigo')} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                    <select value={form.unidade || 'ton'} onChange={set('unidade')} className="input-field">
                      <option value="ton">Tonelada (ton)</option>
                      <option value="saco">Saco</option>
                      <option value="kg">Kg</option>
                      <option value="m3">M³</option>
                      <option value="un">Unidade</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço Padrão (R$) *</label>
                  <input required type="number" step="0.01" min="0" value={form.precoPadrao || ''} onChange={set('precoPadrao')} className="input-field" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Atual</label>
                    <input type="number" step="0.001" min="0" value={form.estoqueAtual || ''} onChange={set('estoqueAtual')} className="input-field" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Mínimo</label>
                    <input type="number" step="0.001" min="0" value={form.estoqueMinimo || ''} onChange={set('estoqueMinimo')} className="input-field" placeholder="0" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button type="submit" disabled={salvando} className="btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button>
                <button type="button" onClick={() => setMostrarForm(false)} className="btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Produto</th>
                <th className="table-header">Código</th>
                <th className="table-header">Unidade</th>
                <th className="table-header">Preço Padrão</th>
                <th className="table-header">Estoque Atual</th>
                <th className="table-header">Estoque Mín.</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {produtos.map(p => {
                const baixo = parseFloat(String(p.estoqueAtual)) <= parseFloat(String(p.estoqueMinimo));
                return (
                  <tr key={p.id} className="table-row">
                    <td className="table-cell font-medium">{p.nome}</td>
                    <td className="table-cell font-mono text-sm text-gray-500">{p.codigo}</td>
                    <td className="table-cell">{p.unidade}</td>
                    <td className="table-cell">{formatMoney(p.precoPadrao)}</td>
                    <td className="table-cell">
                      <span className={`font-medium ${baixo ? 'text-red-600' : 'text-gray-900'}`}>
                        {baixo && <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />}
                        {parseFloat(String(p.estoqueAtual)).toLocaleString('pt-BR')} {p.unidade}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500">{parseFloat(String(p.estoqueMinimo)).toLocaleString('pt-BR')} {p.unidade}</td>
                    <td className="table-cell">
                      <button onClick={() => handleEditar(p)} className="text-blue-600 hover:underline text-sm font-medium">
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
