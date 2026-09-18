import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { Cliente } from '@/features/clientes/types';
import { ClienteForm, type ClienteFormState } from '@/features/clientes/components/ClienteForm';

type Props = {
  form: Partial<Cliente>;
  setForm: Dispatch<SetStateAction<Partial<Cliente>>>;
  freteEnabled: boolean;
  nfeEnabled?: boolean;
  erro: string;
  salvando: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  loadVendedorOptions: (query: string) => Promise<{ id: number; label: string }[]>;
  loadVendedorLabelById: (id: string) => Promise<string | null>;
  condicoesPagamento?: { id: number; nome: string; diasParcelas: number[] }[];
};

export function ClienteEditForm({
  form,
  setForm,
  freteEnabled,
  nfeEnabled = false,
  erro,
  salvando,
  onSubmit,
  loadVendedorOptions,
  loadVendedorLabelById,
  condicoesPagamento = [],
}: Props) {
  return (
    <ClienteForm
      mode="edit"
      form={form as ClienteFormState}
      setForm={setForm as Dispatch<SetStateAction<ClienteFormState>>}
      freteEnabled={freteEnabled}
      nfeEnabled={nfeEnabled}
      loadVendedorOptions={loadVendedorOptions}
      loadVendedorLabelById={loadVendedorLabelById}
      condicoesPagamento={condicoesPagamento}
      erro={erro}
      salvando={salvando}
      onSubmit={onSubmit}
    />
  );
}
