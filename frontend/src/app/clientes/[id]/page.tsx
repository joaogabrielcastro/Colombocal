"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { reportApiError } from "@/lib/report-api-error";
import { ClienteHeader } from "@/features/clientes/components/ClienteHeader";
import { ClienteResumoFinanceiro } from "@/features/clientes/components/ClienteResumoFinanceiro";
import { ClienteContaTab } from "@/features/clientes/components/ClienteContaTab";
import { ClienteChequesTab } from "@/features/clientes/components/ClienteChequesTab";
import { ClientePrecosTab } from "@/features/clientes/components/ClientePrecosTab";
import { ClienteComissoesTab } from "@/features/clientes/components/ClienteComissoesTab";
import { ClienteEditForm } from "@/features/clientes/components/ClienteEditForm";
import { useClienteDetail } from "@/features/clientes/hooks/useClienteDetail";
import type { ClienteAba } from "@/features/clientes/types";

const abas: ClienteAba[] = ["conta", "cheques", "precos", "comissoes", "editar"];

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { freteEnabled } = useTenantFeatures();
  const [aba, setAba] = useState<ClienteAba>("conta");
  const detail = useClienteDetail(id, freteEnabled, { onClienteSalvo: () => setAba("conta") });

  useEffect(() => {
    const abaUrl = searchParams.get("aba");
    if (abas.includes(abaUrl as ClienteAba)) setAba(abaUrl as ClienteAba);
  }, [searchParams]);

  const selecionarAba = (tab: ClienteAba) => {
    setAba(tab);
    router.replace(`/clientes/${id}?aba=${tab}`);
    if (tab === "comissoes" && !detail.comissoesData) {
      void detail.carregarComissoes().catch((e) =>
        reportApiError(e, { title: "Erro ao carregar comissões" }),
      );
    }
  };

  if (detail.loading) return <DetailPageSkeleton />;
  if (!detail.conta) return <div className="p-6 max-w-lg mx-auto flex items-center min-h-[40vh]"><EmptyState title="Cliente não encontrado ou indisponível" action={<button type="button" className="btn-primary" onClick={() => void detail.carregarPrincipal()}>Tentar novamente</button>} /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ClienteHeader cliente={detail.conta.cliente} clienteId={id} />
      <ClienteResumoFinanceiro conta={detail.conta} clienteId={id} />
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {abas.map((tab) => <button key={tab} type="button" onClick={() => selecionarAba(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aba === tab ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-900"}`}>
          {tab === "conta" ? "Conta Corrente" : tab === "cheques" ? `Cheques (${detail.cheques.length})` : tab === "precos" ? "Preços Especiais" : tab === "comissoes" ? "Comissões" : "Editar Cliente"}
        </button>)}
      </div>
      {aba === "conta" && <ClienteContaTab conta={detail.conta} clienteId={id} freteEnabled={freteEnabled} fretesPendentes={detail.fretesPendentes} pgFreteTipo={detail.pgFreteTipo} setPgFreteTipo={detail.setPgFreteTipo} pgFreteData={detail.pgFreteData} setPgFreteData={detail.setPgFreteData} pagandoFreteId={detail.pagandoFreteId} onPagarFrete={(frete) => void detail.handlePagarFrete(frete)} />}
      {aba === "cheques" && <ClienteChequesTab clienteId={id} cheques={detail.cheques} filtroChqIni={detail.filtroChqIni} filtroChqFim={detail.filtroChqFim} buscaChq={detail.buscaChq} setFiltroChqIni={detail.setFiltroChqIni} setFiltroChqFim={detail.setFiltroChqFim} setBuscaChq={detail.setBuscaChq} onFiltrar={() => void detail.carregarCheques()} />}
      {aba === "precos" && <ClientePrecosTab produtos={detail.produtos} precosEdit={detail.precosEdit} setPrecosEdit={detail.setPrecosEdit} salvando={detail.salvandoPrecos} onSalvar={() => void detail.handleSalvarPrecos()} />}
      {aba === "comissoes" && <ClienteComissoesTab comissoesData={detail.comissoesData} comissoesEdit={detail.comissoesEdit} setComissoesEdit={detail.setComissoesEdit} salvando={detail.salvandoComissoes} onSalvar={() => void detail.handleSalvarComissoes()} />}
      {aba === "editar" && <ClienteEditForm form={detail.form} setForm={detail.setForm} freteEnabled={freteEnabled} erro={detail.erro} salvando={detail.salvandoForm} onSubmit={detail.handleSalvarCliente} loadVendedorOptions={detail.loadVendedorOptions} loadVendedorLabelById={detail.loadVendedorLabelById} />}
    </div>
  );
}
