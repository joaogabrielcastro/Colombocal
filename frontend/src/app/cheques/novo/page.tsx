'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { type Cliente } from '@/lib/utils';
import api from '@/lib/api';

export default function NovoChequeePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preClienteId = searchParams.get('clienteId');

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [form, setForm] = useState({
    clienteId: preClienteId || '',
    valor: '',
    banco: '',
    numero: '',
    agencia: '',
    conta: '',
    dataRecebimento: new Date().toISOString().split('T')[0],
    dataCompensacao: '',
    observacoes: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get<Cliente[]>('/clientes?ativo=true').then(setClientes);
  }, []);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clienteId || !form.valor) { setErro('Selecione o cliente e informe o valor'); return; }
    setSalvando(true);
    setErro('');
    try {
      await api.post('/cheques', {
        ...form,
        valor: parseFloat(form.valor),
        dataCompensacao: form.dataCompensacao || undefined,
      });
      router.push('/cheques');
    } catch (e: any) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cheques" className="btn-secondary py-1.5 px-2.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registrar Cheque</h1>
          <p className="text-gray-500 text-sm">O saldo do cliente será atualizado automaticamente</p>
        </div>
      </div>

      {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>}

      <form onSubmit={handleSubmit} className="card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <select required value={form.clienteId} onChange={set('clienteId')} className="input-field">
              <option value="">Selecione o cliente</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Cheque (R$) *</label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={form.valor}
              onChange={set('valor')}
              className="input-field"
              placeholder="0,00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Recebimento</label>
            <input type="date" value={form.dataRecebimento} onChange={set('dataRecebimento')} className="input-field" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
            <input value={form.banco} onChange={set('banco')} className="input-field" placeholder="ex: Bradesco, Itaú..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número do Cheque</label>
            <input value={form.numero} onChange={set('numero')} className="input-field" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agência</label>
            <input value={form.agencia} onChange={set('agencia')} className="input-field" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conta</label>
            <input value={form.conta} onChange={set('conta')} className="input-field" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Data prevista de compensação</label>
            <input type="date" value={form.dataCompensacao} onChange={set('dataCompensacao')} className="input-field" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={set('observacoes')} className="input-field" rows={2} />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button type="submit" disabled={salvando} className="btn-primary">
            {salvando ? 'Registrando...' : 'Registrar Cheque'}
          </button>
          <Link href="/cheques" className="btn-secondary">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
