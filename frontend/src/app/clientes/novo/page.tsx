'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';

interface CnpjData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  telefone: string;
  cidade: string;
  estado: string;
  endereco: string;
}

const initialForm = {
  cnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  telefone: '',
  cidade: '',
  estado: '',
  endereco: '',
  observacoes: '',
  fretePadrao: '',
};

export default function NovoClientePage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [cnpjBusca, setCnpjBusca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const handleBuscarCNPJ = async () => {
    const cnpj = cnpjBusca.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      setErro('Informe um CNPJ válido com 14 dígitos');
      return;
    }
    setBuscando(true);
    setErro('');
    try {
      const data = await api.get<CnpjData>(`/cnpj/${cnpj}`);
      setForm(prev => ({
        ...prev,
        cnpj: data.cnpj,
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia || data.razaoSocial,
        telefone: data.telefone || '',
        cidade: data.cidade || '',
        estado: data.estado || '',
        endereco: data.endereco || '',
      }));
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setBuscando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      const cliente = await api.post<{ id: number }>('/clientes', {
        ...form,
        fretePadrao: parseFloat(form.fretePadrao || '0'),
      });
      router.push(`/clientes/${cliente.id}`);
    } catch (e: any) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clientes" className="btn-secondary py-1.5 px-2.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Cliente</h1>
          <p className="text-gray-500 text-sm">Busque pelo CNPJ para preencher automaticamente</p>
        </div>
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>
      )}

      {/* Busca CNPJ */}
      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-3">Busca por CNPJ</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="00.000.000/0000-00"
            value={cnpjBusca}
            onChange={e => setCnpjBusca(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBuscarCNPJ()}
            className="input-field flex-1"
            maxLength={18}
          />
          <button onClick={handleBuscarCNPJ} disabled={buscando} className="btn-primary">
            <MagnifyingGlassIcon className="w-4 h-4" />
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Dados do Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ *</label>
            <input required value={form.cnpj} onChange={set('cnpj')} className="input-field" placeholder="00000000000000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input value={form.telefone} onChange={set('telefone')} className="input-field" placeholder="(XX) XXXXX-XXXX" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label>
            <input required value={form.razaoSocial} onChange={set('razaoSocial')} className="input-field" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label>
            <input value={form.nomeFantasia} onChange={set('nomeFantasia')} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
            <input value={form.cidade} onChange={set('cidade')} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <input value={form.estado} onChange={set('estado')} className="input-field" placeholder="SP" maxLength={2} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
            <input value={form.endereco} onChange={set('endereco')} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frete Padrão (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.fretePadrao}
              onChange={set('fretePadrao')}
              className="input-field"
              placeholder="0,00"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={set('observacoes')} className="input-field" rows={3} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button type="submit" disabled={salvando} className="btn-primary">
            {salvando ? 'Salvando...' : 'Salvar Cliente'}
          </button>
          <Link href="/clientes" className="btn-secondary">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
