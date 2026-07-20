import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { Cliente } from '@/features/clientes/types';
import { ClienteForm, type ClienteFormState } from '@/features/clientes/components/ClienteForm';

type Props = {
  form: Partial<Cliente>;
  setForm: Dispatch<SetStateAction<Partial<Cliente>>>;
  freteEnabled: boolean;
  erro: string;
  salvando: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  loadVendedorOptions: (query: string) => Promise<{ id: number; label: string }[]>;
  loadVendedorLabelById: (id: string) => Promise<string | null>;
};

export function ClienteEditForm({
  form,
  setForm,
  freteEnabled,
  erro,
  salvando,
  onSubmit,
  loadVendedorOptions,
  loadVendedorLabelById,
}: Props) {
  return (
    <ClienteForm
      mode="edit"
      form={form as ClienteFormState}
      setForm={setForm as Dispatch<SetStateAction<ClienteFormState>>}
      freteEnabled={freteEnabled}
      loadVendedorOptions={loadVendedorOptions}
      loadVendedorLabelById={loadVendedorLabelById}
      erro={erro}
      salvando={salvando}
      onSubmit={onSubmit}
    />
  );
}
