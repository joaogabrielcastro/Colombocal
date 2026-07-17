'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';
import type { Vendedor } from '@/lib/utils';
import { useTenantFeatures } from '@/hooks/useTenantFeatures';
import { isValidCpf, isValidCnpjDigits } from '@/lib/document-validation';
import {
  ClienteForm,
  type ClienteFormState,
  type TipoPessoa,
} from '@/features/clientes/components/ClienteForm';

interface CnpjData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  telefone: string;
  cidade: string;
  estado: string;
  endereco: string;
}

const initialForm: ClienteFormState = {
  cpf: '',
  cnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  telefone: '',
  cidade: '',
  estado: '',
  endereco: '',
  observacoes: '',
  fretePadraoSaco: '',
  fretePadraoTonelada: '',
  vendedorId: '',
  comissaoFixaPercentual: '',
};

export default function NovoClientePage() {
  const router = useRouter();
  const { clienteCpfEnabled: permiteCpf, freteEnabled } = useTenantFeatures();
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>('PJ');
  const [form, setForm] = useState<ClienteFormState>(initialForm);
  const [cnpjBusca, setCnpjBusca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (permiteCpf) setTipoPessoa('PF');
  }, [permiteCpf]);

  const isPf = permiteCpf && tipoPessoa === 'PF';

  const loadVendedorOptions = useCallback(async (q: string) => {
    const p = new URLSearchParams({ take: '80' });
    if (q.trim()) p.set('busca', q.trim());
    const r = await api.get<Vendedor[]>(`/vendedores?${p}`);
    return r.map((v) => ({
      id: v.id,
      label: `${v.nome} (${v.comissaoPercentual}% padrão)`,
    }));
  }, []);

  const loadVendedorLabelById = useCallback(async (id: string) => {
    const v = await api.get<Vendedor>(`/vendedores/${id}`);
    return `${v.nome} (${v.comissaoPercentual}% padrão)`;
  }, []);

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
      setForm((prev) => ({
        ...prev,
        cnpj: data.cnpj,
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia || data.razaoSocial,
        telefone: data.telefone || '',
        cidade: data.cidade || '',
        estado: data.estado || '',
        endereco: data.endereco || '',
      }));
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao buscar CNPJ');
    } finally {
      setBuscando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro('');

    if (tipoPessoa === 'PF') {
      if (!isValidCpf(form.cpf ?? '')) {
        setErro('CPF inválido. Verifique os dígitos.');
        setSalvando(false);
        return;
      }
    } else if (!isValidCnpjDigits(form.cnpj ?? '')) {
      setErro('CNPJ deve ter 14 dígitos.');
      setSalvando(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        tipoPessoa,
        razaoSocial: (form.razaoSocial ?? '').trim(),
        nomeFantasia: (form.nomeFantasia ?? '').trim() || null,
        telefone: (form.telefone ?? '').trim() || null,
        cidade: (form.cidade ?? '').trim() || null,
        estado: (form.estado ?? '').trim() || null,
        endereco: (form.endereco ?? '').trim() || null,
        observacoes: (form.observacoes ?? '').trim() || null,
        ...(freteEnabled
          ? {
              fretePadraoSaco: parseFloat(String(form.fretePadraoSaco || '0')),
              fretePadraoTonelada: parseFloat(String(form.fretePadraoTonelada || '0')),
            }
          : {}),
        vendedorId: form.vendedorId ? parseInt(String(form.vendedorId), 10) : undefined,
        comissaoFixaPercentual:
          form.comissaoFixaPercentual !== '' && form.comissaoFixaPercentual != null
            ? parseFloat(String(form.comissaoFixaPercentual).replace(',', '.'))
            : undefined,
      };

      if (tipoPessoa === 'PF') {
        payload.cpf = String(form.cpf ?? '').replace(/\D/g, '');
      } else {
        payload.cnpj = String(form.cnpj ?? '').replace(/\D/g, '');
      }

      const cliente = await api.post<{ id: number }>('/clientes', payload);
      router.push(`/clientes/${cliente.id}`);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar cliente');
      setSalvando(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clientes" className="btn-secondary py-1.5 px-2.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Cliente</h1>
          <p className="text-gray-500 text-sm">
            {permiteCpf && isPf
              ? 'Cadastro de pessoa física com CPF'
              : 'Busque pelo CNPJ para preencher automaticamente'}
          </p>
        </div>
      </div>

      <ClienteForm
        mode="create"
        form={form}
        setForm={setForm}
        freteEnabled={freteEnabled}
        permiteCpf={permiteCpf}
        tipoPessoa={tipoPessoa}
        setTipoPessoa={setTipoPessoa}
        cnpjBusca={cnpjBusca}
        setCnpjBusca={setCnpjBusca}
        buscandoCnpj={buscando}
        onBuscarCnpj={() => void handleBuscarCNPJ()}
        loadVendedorOptions={loadVendedorOptions}
        loadVendedorLabelById={loadVendedorLabelById}
        erro={erro}
        salvando={salvando}
        onSubmit={handleSubmit}
        footerExtra={<Link href="/clientes" className="btn-secondary">Cancelar</Link>}
      />
    </div>
  );
}
