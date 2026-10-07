'use client';
import { useEffect, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { type Motorista } from '@/lib/utils';
import api from '@/lib/api';
import { TableListSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ListScaffold } from '@/components/ui/list-scaffold';
import { ModalSurface } from '@/components/ui/modal-surface';
import { reportApiError } from '@/lib/report-api-error';

export default function MotoristasPage() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<null | Motorista>(null);
  const [form, setForm] = useState<Partial<Motorista>>({});
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [motoristaToDelete, setMotoristaToDelete] = useState<Motorista | null>(null);

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
  const confirmarExclusao = async () => {
    if (!motoristaToDelete) return;
    setDeletingId(motoristaToDelete.id);
    try {
      await api.delete(`/motoristas/${motoristaToDelete.id}`);
      carregar();
      setMotoristaToDelete(null);
    } catch (e) {
      reportApiError(e, { title: 'Não foi possível excluir o motorista' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <ListScaffold
        title="Motoristas"
        subtitle={`${motoristas.length} motoristas cadastrados`}
        actions={
          <button onClick={() => { setMostrarForm(true); setEditando(null); setForm({}); setErro(''); }} className="btn-primary">
            <PlusIcon className="w-4 h-4" /> Novo Motorista
          </button>
        }
        content={
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
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleEditar(m)} className="text-blue-600 hover:underline text-sm font-medium">Editar</button>
                          <button
                            onClick={() => setMotoristaToDelete(m)}
                            disabled={deletingId === m.id}
                            className="text-red-600 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingId === m.id ? 'Inativando...' : 'Inativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        }
      />

      <ModalSurface
        open={mostrarForm}
        ariaLabel={editando ? 'Editar motorista' : 'Novo motorista'}
        onClose={() => setMostrarForm(false)}
        closeDisabled={salvando}
      >
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 id="motorista-form-title" className="font-semibold">{editando ? 'Editar Motorista' : 'Novo Motorista'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              {erro && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>}
              <div>
                <label htmlFor="motorista-nome" className="field-label">Nome *</label>
                <input id="motorista-nome" required value={form.nome || ''} onChange={set('nome')} className="input-field" />
              </div>
              <div>
                <label htmlFor="motorista-telefone" className="field-label">Telefone</label>
                <input id="motorista-telefone" value={form.telefone || ''} onChange={set('telefone')} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="motorista-veiculo" className="field-label">Veículo</label>
                  <input id="motorista-veiculo" value={form.veiculo || ''} onChange={set('veiculo')} className="input-field" placeholder="ex: Caminhão" />
                </div>
                <div>
                  <label htmlFor="motorista-placa" className="field-label">Placa</label>
                  <input id="motorista-placa" value={form.placa || ''} onChange={set('placa')} className="input-field" placeholder="ABC-1234" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={salvando} className="btn-primary">{salvando ? 'Salvando...' : 'Salvar'}</button>
                <button type="button" onClick={() => setMostrarForm(false)} className="btn-secondary">Cancelar</button>
              </div>
            </form>
      </ModalSurface>

      <ConfirmDialog
        open={!!motoristaToDelete}
        title="Inativar motorista"
        description={
          motoristaToDelete
            ? `Deseja inativar "${motoristaToDelete.nome}"?`
            : undefined
        }
        tone="danger"
        busy={deletingId != null}
        confirmText="Inativar"
        onCancel={() => setMotoristaToDelete(null)}
        onConfirm={() => void confirmarExclusao()}
      />
    </>
  );
}
