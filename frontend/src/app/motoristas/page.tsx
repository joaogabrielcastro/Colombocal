'use client';
import { useEffect, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { type Motorista } from '@/lib/utils';
import api from '@/lib/api';
import { TableListSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { reportApiError } from '@/lib/report-api-error';

export default function MotoristasPage() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<null | Motorista>(null);
  const [form, setForm] = useState<Partial<Motorista>>({});
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = () => {
    setLoading(true);
    api
      .get<Motorista[]>('/motoristas')
      .then(setMotoristas)
      .catch((e) => {
        reportApiError(e, { title: 'Motoristas', onRetry: () => void carregar() });
        setMotoristas([]);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { carregar(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      if (editando) {
        await api.put(`/motoristas/${editando.id}`, form);
      } else {
        await api.post('/motoristas', form);
      }
      setMostrarForm(false);
      setEditando(null);
      setForm({});
      carregar();
    } catch (e) {
      reportApiError(e, { title: 'Erro ao salvar motorista' });
      setErro(e instanceof Error ? e.message : '');
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (m: Motorista) => { setEditando(m); setForm(m); setMostrarForm(true); setErro(''); };
  const set = (f: keyof Motorista) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [f]: e.target.value }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Motoristas</h1>
          <p className="text-gray-500 text-sm mt-1">{motoristas.length} motoristas cadastrados</p>
        </div>
        <button onClick={() => { setMostrarForm(true); setEditando(null); setForm({}); setErro(''); }} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Novo Motorista
        </button>
      </div>

      {mostrarForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="font-semibold">{editando ? 'Editar Motorista' : 'Novo Motorista'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              {erro && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input required value={form.nome || ''} onChange={set('nome')} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input value={form.telefone || ''} onChange={set('telefone')} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Veículo</label>
                  <input value={form.veiculo || ''} onChange={set('veiculo')} className="input-field" placeholder="ex: Caminhão" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Placa</label>
                  <input value={form.placa || ''} onChange={set('placa')} className="input-field" placeholder="ABC-1234" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={salvando} className="btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button>
                <button type="button" onClick={() => setMostrarForm(false)} className="btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableListSkeleton rows={6} cols={4} />
          </div>
        ) : motoristas.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Nenhum motorista cadastrado" description="Cadastre motoristas para vincular às vendas." />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Nome</th>
                <th className="table-header">Telefone</th>
                <th className="table-header">Veículo</th>
                <th className="table-header">Placa</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {motoristas.map(m => (
                <tr key={m.id} className="table-row">
                  <td className="table-cell font-medium">{m.nome}</td>
                  <td className="table-cell">{m.telefone || '-'}</td>
                  <td className="table-cell">{m.veiculo || '-'}</td>
                  <td className="table-cell font-mono">{m.placa || '-'}</td>
                  <td className="table-cell">
                    <button onClick={() => handleEditar(m)} className="text-blue-600 hover:underline text-sm font-medium">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
