"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/utils";
import { reportApiError } from "@/lib/report-api-error";
import { HomologacaoBanner } from "@/features/fiscal/components/HomologacaoBanner";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { toast } from "sonner";

type CteDetail = {
  id: number;
  status: string;
  ambiente?: string;
  numero?: number | null;
  serie?: number | null;
  chaveAcesso?: string | null;
  protocolo?: string | null;
  emitenteNome?: string | null;
  remetenteNome?: string | null;
  destinatarioNome?: string | null;
  tomadorNome?: string | null;
  origemMunicipio?: string | null;
  origemUf?: string | null;
  destinoMunicipio?: string | null;
  destinoUf?: string | null;
  valorServico?: number | null;
  valorCarga?: number | null;
  pesoKg?: number | null;
  observacoes?: string | null;
  emitidaEm?: string | null;
  xmlUrl?: string | null;
  dacteUrl?: string | null;
  motivoRejeicao?: string | null;
  erroTecnico?: string | null;
};

export default function FiscalCteDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { cteEnabled } = useTenantFeatures();
  const [doc, setDoc] = useState<CteDetail | null>(null);

  useEffect(() => {
    if (!cteEnabled || !Number.isFinite(id)) return;
    api
      .get<CteDetail>(`/fiscal/cte/${id}`)
      .then(setDoc)
      .catch((err) => reportApiError(err, { title: "CT-e não encontrado." }));
  }, [id, cteEnabled]);

  const consultar = async () => {
    try {
      const next = await api.post<CteDetail>(`/fiscal/cte/${id}/consultar`, {});
      setDoc(next);
      toast.success("Status atualizado.");
    } catch (err) {
      reportApiError(err, { title: "Falha ao consultar CT-e." });
    }
  };

  if (!cteEnabled) {
    return <p className="p-6 text-sm text-gray-600">Módulo CT-e desabilitado.</p>;
  }
  if (!doc) return <p className="p-6 text-sm text-gray-500">Carregando…</p>;

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <Link href="/fiscal/cte" className="text-sm text-blue-700 hover:underline">
        ← Voltar
      </Link>
      <h1 className="text-xl font-semibold">
        CT-e {doc.numero ?? doc.id} · série {doc.serie ?? "—"}
      </h1>
      <HomologacaoBanner ambiente={doc.ambiente || "homologacao"} />
      <div className="card p-4 space-y-2 text-sm">
        <p>
          <strong>Status:</strong> <span className="capitalize">{doc.status}</span>
        </p>
        <p>
          <strong>Emissão:</strong> {doc.emitidaEm ? formatDate(doc.emitidaEm) : "—"}
        </p>
        <p>
          <strong>Chave:</strong> {doc.chaveAcesso || "—"}
        </p>
        <p>
          <strong>Remetente:</strong> {doc.remetenteNome || "—"}
        </p>
        <p>
          <strong>Destinatário:</strong> {doc.destinatarioNome || "—"}
        </p>
        <p>
          <strong>Tomador:</strong> {doc.tomadorNome || "—"}
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
          <strong>Valor serviço:</strong>{" "}
          {doc.valorServico != null ? formatMoney(doc.valorServico) : "—"}
        </p>
        <p>
          <strong>Valor carga:</strong>{" "}
          {doc.valorCarga != null ? formatMoney(doc.valorCarga) : "—"}
        </p>
        {doc.motivoRejeicao ? (
          <p className="text-red-700">
            <strong>Motivo:</strong> {doc.motivoRejeicao}
          </p>
        ) : null}
        {doc.erroTecnico ? (
          <p className="text-amber-700">
            <strong>Erro técnico:</strong> {doc.erroTecnico}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary text-sm" onClick={() => void consultar()}>
          Consultar status
        </button>
        {doc.xmlUrl ? (
          <a className="btn-secondary text-sm" href={`/api/fiscal/cte/${id}/xml`}>
            XML
          </a>
        ) : (
          <span className="text-xs text-gray-500 self-center">XML indisponível</span>
        )}
        {doc.dacteUrl ? (
          <a className="btn-secondary text-sm" href={`/api/fiscal/cte/${id}/dacte`}>
            DACTE
          </a>
        ) : (
          <span className="text-xs text-gray-500 self-center">DACTE indisponível</span>
        )}
      </div>
    </div>
  );
}
