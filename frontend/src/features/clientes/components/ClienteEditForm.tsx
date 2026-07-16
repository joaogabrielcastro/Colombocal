import SearchableSelect from "@/components/SearchableSelect";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import type { Cliente } from "@/features/clientes/types";

type Props = {
  form: Partial<Cliente>; setForm: Dispatch<SetStateAction<Partial<Cliente>>>; freteEnabled: boolean;
  erro: string; salvando: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  loadVendedorOptions: (query: string) => Promise<{ id: number; label: string }[]>;
  loadVendedorLabelById: (id: string) => Promise<string>;
};

export function ClienteEditForm({ form, setForm, freteEnabled, erro, salvando, onSubmit, loadVendedorOptions, loadVendedorLabelById }: Props) {
  return <form onSubmit={(e) => void onSubmit(e)} className="card p-5">
    {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Razão Social *" className="md:col-span-2"><input required value={form.razaoSocial || ""} onChange={(e) => setForm((p) => ({ ...p, razaoSocial: e.target.value }))} className="input-field" /></Field>
      <Field label="Nome Fantasia" className="md:col-span-2"><input value={form.nomeFantasia || ""} onChange={(e) => setForm((p) => ({ ...p, nomeFantasia: e.target.value }))} className="input-field" /></Field>
      <Field label="Telefone"><input value={form.telefone || ""} onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))} className="input-field" /></Field>
      {freteEnabled && <><Field label="Frete padrão por saco (R$)"><input type="number" step="0.01" min="0" value={form.fretePadraoSaco ?? form.fretePadrao ?? ""} onChange={(e) => setForm((p) => ({ ...p, fretePadraoSaco: e.target.value === "" ? undefined : parseFloat(e.target.value) }))} className="input-field" /></Field>
        <Field label="Frete padrão por tonelada (R$)"><input type="number" step="0.01" min="0" value={form.fretePadraoTonelada ?? ""} onChange={(e) => setForm((p) => ({ ...p, fretePadraoTonelada: e.target.value === "" ? undefined : parseFloat(e.target.value) }))} className="input-field" /></Field></>}
      <SearchableSelect label="Vendedor do cliente" value={form.vendedorId != null ? String(form.vendedorId) : ""} onChange={(vid) => setForm((p) => ({ ...p, vendedorId: vid ? parseInt(vid, 10) : null }))} loadOptions={loadVendedorOptions} loadLabelById={loadVendedorLabelById} minChars={0} placeholder="Nenhum — digite para buscar" />
      <Field label="Comissão fixa (%)"><input type="number" step="0.01" min="0" value={form.comissaoFixaPercentual ?? ""} onChange={(e) => setForm((p) => ({ ...p, comissaoFixaPercentual: e.target.value ? parseFloat(e.target.value) : undefined }))} className="input-field" placeholder="Opcional" /></Field>
      <Field label="Cidade"><input value={form.cidade || ""} onChange={(e) => setForm((p) => ({ ...p, cidade: e.target.value }))} className="input-field" /></Field>
      <Field label="Estado"><input value={form.estado || ""} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))} className="input-field" maxLength={2} /></Field>
      <Field label="Endereço" className="md:col-span-2"><input value={form.endereco || ""} onChange={(e) => setForm((p) => ({ ...p, endereco: e.target.value }))} className="input-field" /></Field>
      <Field label="Observações" className="md:col-span-2"><textarea value={form.observacoes || ""} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} className="input-field" rows={3} /></Field>
    </div>
    <div className="flex gap-3 mt-5"><button type="submit" disabled={salvando} className="btn-primary">{salvando ? "Salvando..." : "Salvar Alterações"}</button></div>
  </form>;
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
