'use client';

import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import SearchableSelect from '@/components/SearchableSelect';

export type TipoPessoa = 'PF' | 'PJ';

export type ClienteFormState = {
  cpf?: string;
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  observacoes?: string;
  fretePadraoSaco?: string | number;
  fretePadraoTonelada?: string | number;
  fretePadrao?: string | number;
  vendedorId?: string | number | null;
  comissaoFixaPercentual?: string | number | null;
  inscricaoEstadual?: string | null;
  indIEDest?: string | number | null;
  cep?: string | null;
  bairro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  codigoMunicipio?: string | null;
};

type Props = {
  mode: 'create' | 'edit';
  form: ClienteFormState;
  setForm: Dispatch<SetStateAction<ClienteFormState>>;
  freteEnabled: boolean;
  nfeEnabled?: boolean;
  permiteCpf?: boolean;
  tipoPessoa?: TipoPessoa;
  setTipoPessoa?: (t: TipoPessoa) => void;
  cnpjBusca?: string;
  setCnpjBusca?: (v: string) => void;
  buscandoCnpj?: boolean;
  onBuscarCnpj?: () => void;
  loadVendedorOptions: (q: string) => Promise<{ id: number; label: string }[]>;
  loadVendedorLabelById: (id: string) => Promise<string | null>;
  erro: string;
  salvando: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  footerExtra?: ReactNode;
};

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

export function ClienteForm({
  mode,
  form,
  setForm,
  freteEnabled,
  nfeEnabled = false,
  permiteCpf = false,
  tipoPessoa = 'PJ',
  setTipoPessoa,
  cnpjBusca = '',
  setCnpjBusca,
  buscandoCnpj = false,
  onBuscarCnpj,
  loadVendedorOptions,
  loadVendedorLabelById,
  erro,
  salvando,
  onSubmit,
  submitLabel,
  footerExtra,
}: Props) {
  const isCreate = mode === 'create';
  const isPf = isCreate && permiteCpf && tipoPessoa === 'PF';

  const setField =
    (field: keyof ClienteFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const freteSacoVal =
    form.fretePadraoSaco ?? form.fretePadrao ?? '';
  const freteTonVal = form.fretePadraoTonelada ?? '';

  return (
    <>
      {isCreate && permiteCpf && setTipoPessoa ? (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-3">Tipo de cliente</h2>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="tipoPessoa"
                checked={tipoPessoa === 'PF'}
                onChange={() => setTipoPessoa('PF')}
              />
              Pessoa física (CPF)
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="tipoPessoa"
                checked={tipoPessoa === 'PJ'}
                onChange={() => setTipoPessoa('PJ')}
              />
              Pessoa jurídica (CNPJ)
            </label>
          </div>
        </div>
      ) : null}

      {isCreate && !isPf && onBuscarCnpj && setCnpjBusca ? (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-3">Busca por CNPJ</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="00.000.000/0000-00"
              value={cnpjBusca}
              onChange={(e) => setCnpjBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onBuscarCnpj();
                }
              }}
              className="input-field flex-1"
              maxLength={18}
            />
            <button type="button" onClick={onBuscarCnpj} disabled={buscandoCnpj} className="btn-primary">
              <MagnifyingGlassIcon className="w-4 h-4" />
              {buscandoCnpj ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="card p-5">
        {erro ? (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {erro}
          </div>
        ) : null}

        <h2 className="font-semibold text-gray-900 mb-4">
          {isCreate ? 'Dados do Cliente' : 'Editar Cliente'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isCreate && isPf ? (
            <Field label="CPF *">
              <input
                required
                value={form.cpf ?? ''}
                onChange={setField('cpf')}
                className="input-field"
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </Field>
          ) : null}

          {isCreate && !isPf ? (
            <Field label="CNPJ *">
              <input
                required
                value={form.cnpj ?? ''}
                onChange={setField('cnpj')}
                className="input-field"
                placeholder="00000000000000"
              />
            </Field>
          ) : null}

          <Field label="Telefone">
            <input
              value={form.telefone ?? ''}
              onChange={setField('telefone')}
              className="input-field"
              placeholder="(XX) XXXXX-XXXX"
            />
          </Field>

          <Field label={isPf ? 'Nome completo *' : 'Razão Social *'} className="md:col-span-2">
            <input
              required
              value={form.razaoSocial ?? ''}
              onChange={setField('razaoSocial')}
              className="input-field"
            />
          </Field>

          {!isPf ? (
            <Field label="Nome Fantasia" className="md:col-span-2">
              <input
                value={form.nomeFantasia ?? ''}
                onChange={setField('nomeFantasia')}
                className="input-field"
              />
            </Field>
          ) : null}

          <Field label="Cidade">
            <input value={form.cidade ?? ''} onChange={setField('cidade')} className="input-field" />
          </Field>

          <Field label="Estado">
            <input
              value={form.estado ?? ''}
              onChange={setField('estado')}
              className="input-field"
              placeholder="SP"
              maxLength={2}
            />
          </Field>

          <Field label="Endereço" className="md:col-span-2">
            <input value={form.endereco ?? ''} onChange={setField('endereco')} className="input-field" />
          </Field>

          {nfeEnabled ? (
            <>
              <Field label="Número">
                <input
                  value={form.numero ?? ''}
                  onChange={setField('numero')}
                  className="input-field"
                  placeholder="123"
                />
              </Field>
              <Field label="Bairro">
                <input value={form.bairro ?? ''} onChange={setField('bairro')} className="input-field" />
              </Field>
              <Field label="Complemento">
                <input value={form.complemento ?? ''} onChange={setField('complemento')} className="input-field" />
              </Field>
              <Field label="CEP">
                <input
                  value={form.cep ?? ''}
                  onChange={setField('cep')}
                  className="input-field"
                  placeholder="00000-000"
                  maxLength={9}
                />
              </Field>
              <Field label="Código IBGE do município">
                <input
                  value={form.codigoMunicipio ?? ''}
                  onChange={setField('codigoMunicipio')}
                  className="input-field"
                  placeholder="7 dígitos"
                  maxLength={7}
                />
              </Field>
              <Field label="Inscrição estadual">
                <input
                  value={form.inscricaoEstadual ?? ''}
                  onChange={setField('inscricaoEstadual')}
                  className="input-field"
                  placeholder="Números ou ISENTO"
                />
              </Field>
              <Field label="Indicador IE (destinatário)">
                <select
                  className="input-field"
                  value={form.indIEDest == null || form.indIEDest === '' ? '' : String(form.indIEDest)}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      indIEDest: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                >
                  <option value="">Automático</option>
                  <option value="1">1 — Contribuinte ICMS</option>
                  <option value="2">2 — Contribuinte isento</option>
                  <option value="9">9 — Não contribuinte</option>
                </select>
              </Field>
            </>
          ) : null}

          {freteEnabled ? (
            <>
              <Field label="Frete padrão por saco (R$)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={freteSacoVal}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, fretePadraoSaco: e.target.value }))
                  }
                  className="input-field"
                  placeholder="0,00"
                />
              </Field>
              <Field label="Frete padrão por tonelada (R$)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={freteTonVal}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, fretePadraoTonelada: e.target.value }))
                  }
                  className="input-field"
                  placeholder="0,00"
                />
              </Field>
            </>
          ) : null}

          <SearchableSelect
            label="Vendedor do cliente"
            value={form.vendedorId != null ? String(form.vendedorId) : ''}
            onChange={(vid) =>
              setForm((p) => ({
                ...p,
                vendedorId: vid ? parseInt(vid, 10) : null,
              }))
            }
            loadOptions={loadVendedorOptions}
            loadLabelById={loadVendedorLabelById}
            minChars={0}
            placeholder="Nenhum — digite para buscar vendedor"
            emptyHint="Lista os primeiros vendedores ativos; refine digitando o nome."
          />

          <Field label="Comissão fixa (%)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.comissaoFixaPercentual ?? ''}
              onChange={(e) =>
                setForm((p) => ({ ...p, comissaoFixaPercentual: e.target.value }))
              }
              className="input-field"
              placeholder="Opcional — sobrescreve o % do vendedor"
            />
          </Field>

          <Field label="Observações" className="md:col-span-2">
            <textarea
              value={form.observacoes ?? ''}
              onChange={setField('observacoes')}
              className="input-field"
              rows={3}
            />
          </Field>
        </div>

        <div className="flex gap-3 mt-5">
          <button type="submit" disabled={salvando} className="btn-primary">
            {salvando
              ? 'Salvando...'
              : submitLabel ?? (isCreate ? 'Salvar Cliente' : 'Salvar Alterações')}
          </button>
          {footerExtra}
        </div>
      </form>
    </>
  );
}
