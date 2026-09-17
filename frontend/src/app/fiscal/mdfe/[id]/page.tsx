"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { reportApiError } from "@/lib/report-api-error";
import { HomologacaoBanner } from "@/features/fiscal/components/HomologacaoBanner";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { toast } from "sonner";

type Doc = {
  id: number;
  tipo: string;
  chaveAcesso: string;
};

type MdfeDetail = {
  id: number;
  status: string;
  ambiente?: string;
  numero?: number | null;
  serie?: number | null;
  chaveAcesso?: string | null;
  ufInicio?: string | null;
  ufFim?: string | null;
  veiculoPlaca?: string | null;
  motoristaNome?: string | null;
  emitidaEm?: string | null;
  encerradaEm?: string | null;
  xmlUrl?: string | null;
  damdfeUrl?: string | null;
  documentos?: Doc[];
};

export default function FiscalMdfeDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { mdfeEnabled } = useTenantFeatures();
  const [doc, setDoc] = useState<MdfeDetail | null>(null);
  const [encerrar, setEncerrar] = useState({
    data: "",
    siglaUf: "",
    nomeMunicipio: "",
  });

  useEffect(() => {
    if (!mdfeEnabled || !Number.isFinite(id)) return;
    api
      .get<MdfeDetail>(`/fiscal/mdfe/${id}`)
      .then(setDoc)
      .catch((err) => reportApiError(err, { title: "MDF-e não encontrado." }));
  }, [id, mdfeEnabled]);

  const doEncerrar = async () => {
    try {
      const next = await api.post<MdfeDetail>(`/fiscal/mdfe/${id}/encerrar`, encerrar);
      setDoc(next);
      toast.success("Encerramento enviado ao provedor.");
    } catch (err) {
      reportApiError(err, { title: "Falha ao encerrar MDF-e." });
    }
  };

  if (!mdfeEnabled) return <p className="p-6 text-sm">Módulo MDF-e desabilitado.</p>;
  if (!doc) return <p className="p-6 text-sm">Carregando…</p>;

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <Link href="/fiscal/mdfe" className="text-sm text-blue-700 hover:underline">
        ← Voltar
      </Link>
      <h1 className="text-xl font-semibold">MDF-e {doc.numero ?? doc.id}</h1>
      <HomologacaoBanner ambiente={doc.ambiente || "homologacao"} />
      <div className="card p-4 space-y-2 text-sm">
        <p>
          <strong>Status:</strong> <span className="capitalize">{doc.status}</span>
        </p>
        <p>
          <strong>UF:</strong> {doc.ufInicio} → {doc.ufFim}
        </p>
        <p>
          <strong>Veículo:</strong> {doc.veiculoPlaca || "—"}
        </p>
        <p>
          <strong>Motorista:</strong> {doc.motoristaNome || "—"}
        </p>
        <p>
          <strong>Emissão:</strong> {doc.emitidaEm ? formatDate(doc.emitidaEm) : "—"}
        </p>
        <p>
          <strong>Chave:</strong> {doc.chaveAcesso || "—"}
        </p>
        <div>
          <strong>Documentos vinculados</strong>
          <ul className="list-disc ml-5 mt-1">
            {(doc.documentos || []).map((d) => (
              <li key={d.id}>
                {d.tipo.toUpperCase()}: {d.chaveAcesso}
              </li>
            ))}
            {!doc.documentos?.length ? <li>Nenhum</li> : null}
          </ul>
        </div>
      </div>
      {doc.status === "autorizada" ? (
        <div className="card p-4 space-y-2">
          <h2 className="font-medium">Encerrar MDF-e</h2>
          <p className="text-xs text-gray-500">
            Encerramento é operação do provedor (não é cancelamento local).
          </p>
          <input
            type="date"
            className="input"
            value={encerrar.data}
            onChange={(e) => setEncerrar((s) => ({ ...s, data: e.target.value }))}
          />
          <input
            className="input"
            placeholder="UF"
            maxLength={2}
            value={encerrar.siglaUf}
            onChange={(e) => setEncerrar((s) => ({ ...s, siglaUf: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Município"
            value={encerrar.nomeMunicipio}
            onChange={(e) => setEncerrar((s) => ({ ...s, nomeMunicipio: e.target.value }))}
          />
          <button type="button" className="btn-primary text-sm" onClick={() => void doEncerrar()}>
            Encerrar no provedor
          </button>
        </div>
      ) : null}
    </div>
  );
}
