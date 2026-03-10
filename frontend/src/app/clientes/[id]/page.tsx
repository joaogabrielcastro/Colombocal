'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, PencilIcon, PlusIcon } from '@heroicons/react/24/outline';
import { formatMoney, formatCNPJ, formatDate, type Cliente, type Produto } from '@/lib/utils';
import api from '@/lib/api';

interface ContaData {
  cliente: Cliente;
  saldo: number;
  totalDebitos: number;
  totalCreditos: number;
  vendas: any[];
  pagamentos: any[];
}

interface ProdutoPreco extends Produto {
  precoEspecial: number | null;
  precoAplicado: number;
}

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [conta, setConta] = useState<ContaData | null>(null);
  const [produtos, setProdutos] = useState<ProdutoPreco[]>([]);
  const [aba, setAba] = useState<'conta' | 'precos' | 'editar'>('conta');
  const [loading, setLoading] = useState(true);
  const [precosEdit, setPrecosEdit] = useState<Record<number, string>>({});
  const [salvandoPrecos, setSalvandoPrecos] = useState(false);
  const [form, setForm] = useState<Partial<Cliente>>({});
  const [salvandoForm, setSalvandoForm] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<ContaData>(`/clientes/${id}/conta`),
      api.get<ProdutoPreco[]>(`/clientes/${id}/precos`),
    ]).then(([contaData, prodData]) => {
      setConta(contaData);
      setForm(contaData.cliente);
      setProdutos(prodData);
      const mapa: Record<number, string> = {};
      prodData.forEach(p => { if (p.precoEspecial) mapa[p.id] = String(p.precoEspecial); });
      setPrecosEdit(mapa);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSalvarPrecos = async () => {
    setSalvandoPrecos(true);
    try {
      const precos = produtos.map(p => ({
        produtoId: p.id,
        preco: precosEdit[p.id] ? parseFloat(precosEdit[p.id]) : null,
      }));
      await api.put(`/clientes/${id}/precos`, { precos });
      const prodData = await api.get<ProdutoPreco[]>(`/clientes/${id}/precos`);
      setProdutos(prodData);
      alert('Preços salvos com sucesso!');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSalvandoPrecos(false);
    }
  };

  const handleSalvarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoForm(true);
    setErro('');
    try {
      await api.put(`/clientes/${id}`, form);
      const contaData = await api.get<ContaData>(`/clientes/${id}/conta`);
      setConta(contaData);
      setForm(contaData.cliente);
      setAba('conta');
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvandoForm(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando...</div>;
  if (!conta) return <div className="p-8 text-center text-gray-400">Cliente não encontrado</div>;

  const { cliente } = conta;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Link href="/clientes" className="btn-secondary py-1.5 px-2.5 mt-1">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{cliente.nomeFantasia || cliente.razaoSocial}</h1>
          <p className="text-gray-500 text-sm">{cliente.razaoSocial} • {formatCNPJ(cliente.cnpj)}</p>
          {cliente.cidade && <p className="text-gray-400 text-xs mt-0.5">{cliente.cidade}{cliente.estado ? ' - ' + cliente.estado : ''}</p>}
        </div>
        <Link href={`/vendas/nova?clienteId=${id}`} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Nova Venda
        </Link>
      </div>

      {/* Saldo card */}
      <div className={`card p-5 mb-6 border-l-4 ${conta.saldo < 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Total Compras</p>
            <p className="text-xl font-bold text-red-600 mt-1">{formatMoney(conta.totalDebitos)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Total Pago</p>
            <p className="text-xl font-bold text-green-600 mt-1">{formatMoney(conta.totalCreditos)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">Saldo</p>
            <p className={`text-xl font-bold mt-1 ${conta.saldo < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatMoney(Math.abs(conta.saldo))}
              <span className="text-sm font-normal ml-1">{conta.saldo < 0 ? '(devendo)' : '(crédito)'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {(['conta', 'precos', 'editar'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setAba(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              aba === tab ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab === 'conta' ? 'Conta Corrente' : tab === 'precos' ? 'Preços Especiais' : 'Editar Cliente'}
          </button>
        ))}
      </div>

      {/* Conta Corrente */}
      {aba === 'conta' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Vendas ({conta.vendas.length})</h3>
              <Link href={`/vendas?clienteId=${id}`} className="text-blue-600 text-xs hover:underline">Ver todas</Link>
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {conta.vendas.length === 0 ? (
                <p className="p-4 text-gray-400 text-sm text-center">Nenhuma venda</p>
              ) : conta.vendas.map((v: any) => (
                <Link key={v.id} href={`/vendas/${v.id}`} className="flex justify-between px-5 py-3 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium">Venda #{v.id}</p>
                    <p className="text-xs text-gray-400">{formatDate(v.dataVenda)}</p>
                  </div>
                  <span className="text-sm font-semibold text-red-600">-{formatMoney(v.valorTotal)}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Pagamentos ({conta.pagamentos.length})</h3>
              <Link href={`/cheques/novo?clienteId=${id}`} className="text-blue-600 text-xs hover:underline">+ Cheque</Link>
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {conta.pagamentos.length === 0 ? (
                <p className="p-4 text-gray-400 text-sm text-center">Nenhum pagamento</p>
              ) : conta.pagamentos.map((p: any) => (
                <div key={p.id} className="flex justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium capitalize">{p.tipo}</p>
                    <p className="text-xs text-gray-400">{formatDate(p.data)}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">+{formatMoney(p.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preços Especiais */}
      {aba === 'precos' && (
        <div className="card">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Preços especiais por produto</h3>
            <p className="text-gray-500 text-xs mt-0.5">Deixe em branco para usar o preço padrão do produto</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Produto</th>
                <th className="table-header">Unidade</th>
                <th className="table-header">Preço Padrão</th>
                <th className="table-header">Preço Especial</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map(p => (
                <tr key={p.id} className="table-row">
                  <td className="table-cell font-medium">{p.nome}</td>
                  <td className="table-cell text-gray-500">{p.unidade}</td>
                  <td className="table-cell">{formatMoney(p.precoPadrao)}</td>
                  <td className="table-cell">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={`${formatMoney(p.precoPadrao)}`}
                      value={precosEdit[p.id] || ''}
                      onChange={e => setPrecosEdit(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="input-field w-36"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-4 border-t border-gray-100">
            <button onClick={handleSalvarPrecos} disabled={salvandoPrecos} className="btn-primary">
              {salvandoPrecos ? 'Salvando...' : 'Salvar Preços'}
            </button>
          </div>
        </div>
      )}

      {/* Editar Cliente */}
      {aba === 'editar' && (
        <form onSubmit={handleSalvarCliente} className="card p-5">
          {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label>
              <input required value={form.razaoSocial || ''} onChange={e => setForm(p => ({ ...p, razaoSocial: e.target.value }))} className="input-field" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label>
              <input value={form.nomeFantasia || ''} onChange={e => setForm(p => ({ ...p, nomeFantasia: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input value={form.telefone || ''} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frete Padrão (R$)</label>
              <input type="number" step="0.01" min="0" value={form.fretePadrao ?? ''} onChange={e => setForm(p => ({ ...p, fretePadrao: parseFloat(e.target.value) }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
              <input value={form.cidade || ''} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <input value={form.estado || ''} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className="input-field" maxLength={2} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
              <input value={form.endereco || ''} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))} className="input-field" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea value={form.observacoes || ''} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} className="input-field" rows={3} />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button type="submit" disabled={salvandoForm} className="btn-primary">
              {salvandoForm ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
