"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/utils";
import { reportApiError } from "@/lib/report-api-error";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";

type CiotDetail = {
  id: number;
  codigoCiot?: string | null;
  codigoVerificador?: string | null;
  status: string;
  transportadorNome?: string | null;
  contratanteNome?: string | null;
  motoristaNome?: string | null;
  veiculoPlaca?: string | null;
  origemMunicipio?: string | null;
  origemUf?: string | null;
  destinoMunicipio?: string | null;
  destinoUf?: string | null;
  valorOperacao?: number | null;
  dataOperacao?: string | null;
  provider?: string | null;
  erroTecnico?: string | null;
  providerName?: string;
};

export default function FiscalCiotDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { ciotEnabled } = useTenantFeatures();
  const [doc, setDoc] = useState<CiotDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!ciotEnabled || !Number.isFinite(id)) return;
    api
      .get<CiotDetail>(`/fiscal/ciot/${id}`)
      .then((value) => { setDoc(value); setLoadError(false); })
      .catch((err) => { setLoadError(true); reportApiError(err, { title: "CIOT não encontrado." }); });
  }, [id, ciotEnabled, retry]);

  if (!ciotEnabled) return <div className="page-container max-w-xl"><EmptyState title="Módulo CIOT desabilitado" description="Ative o módulo nas configurações para consultar este documento." /></div>;
  if (loadError) return <div className="p-6 max-w-lg"><EmptyState title="Não foi possível carregar o CIOT" description="Confira a conexão e tente novamente." action={<button className="btn-primary" onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button>} /></div>;
  if (!doc) return <DetailPageSkeleton />;

  return (
    <div className="page-container space-y-4 max-w-3xl">
      <Link href="/fiscal/ciot" className="text-sm text-blue-700 hover:underline">
        ← Voltar
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">CIOT {doc.codigoCiot || doc.id}</h1>
      <div className="card p-4 space-y-2 text-sm">
        <p>
          <strong>Status:</strong> <span className="capitalize">{doc.status}</span>
        </p>
        <p>
          <strong>Provider:</strong> {doc.providerName || doc.provider || "—"}
        </p>
        <p>
          <strong>Verificador:</strong> {doc.codigoVerificador || "—"}
        </p>
        <p>
          <strong>Data:</strong> {doc.dataOperacao ? formatDate(doc.dataOperacao) : "—"}
        </p>
        <p>
          <strong>Transportador:</strong> {doc.transportadorNome || "—"}
        </p>
        <p>
          <strong>Contratante:</strong> {doc.contratanteNome || "—"}
        </p>
        <p>
          <strong>Motorista:</strong> {doc.motoristaNome || "—"}
        </p>
        <p>
          <strong>Veículo:</strong> {doc.veiculoPlaca || "—"}
        </p>
        <p>
          <strong>Origem:</strong>{" "}
          {[doc.origemMunicipio, doc.origemUf].filter(Boolean).join("/") || "—"}
        </p>
        <p>
          <strong>Destino:</strong>{" "}
          {[doc.destinoMunicipio, doc.destinoUf].filter(Boolean).join("/") || "—"}
        </p>
        <p>
          <strong>Valor:</strong>{" "}
          {doc.valorOperacao != null ? formatMoney(doc.valorOperacao) : "—"}
        </p>
        {doc.erroTecnico ? (
          <p className="text-amber-800">
            <strong>Erro:</strong> {doc.erroTecnico}
          </p>
        ) : null}
      </div>
    </div>
  );
}
