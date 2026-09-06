"use client";

import { useState } from "react";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import api, { ApiError } from "@/lib/api";
import { reportApiError } from "@/lib/report-api-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { NotaFiscal, Venda } from "@/lib/utils";
import { toast } from "sonner";

function statusLabel(status?: string | null) {
  switch (status) {
    case "autorizada":
      return "Autorizada";
    case "processando":
      return "Processando";
    case "rejeitada":
      return "Rejeitada";
    case "cancelada":
      return "Cancelada";
    case "denegada":
      return "Denegada";
    default:
      return status || "Sem nota";
  }
}

function statusClass(status?: string | null) {
  switch (status) {
    case "autorizada":
      return "bg-green-50 text-green-800";
    case "processando":
      return "bg-amber-50 text-amber-800";
    case "rejeitada":
    case "denegada":
      return "bg-red-50 text-red-800";
    case "cancelada":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-50 text-gray-600";
  }
}

async function abrirArquivo(path: string) {
  const { blob, filename } = await api.getBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  if (filename) a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

type Props = {
  venda: Venda;
  onUpdated: () => void;
};

export function VendaNfeActions({ venda, onUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const nota = venda.notaFiscal;

  const emitir = async () => {
    setBusy(true);
    setErros([]);
    try {
      const valid = await api.get<{ ok: boolean; erros: string[] }>(
        `/vendas/${venda.id}/nfe/validacao`,
      );
      if (!valid.ok) {
        setErros(valid.erros);
        toast.error("Cadastro fiscal incompleto");
        return;
      }
      const emitted = await api.post<NotaFiscal>(`/vendas/${venda.id}/nfe`, {});
      onUpdated();
      if (emitted.status === "autorizada") toast.success("NF-e autorizada");
      else if (emitted.status === "rejeitada") toast.error(emitted.motivoRejeicao || "NF-e rejeitada");
      else toast.message(`NF-e: ${statusLabel(emitted.status)}`);
    } catch (e) {
      const details =
        e instanceof ApiError &&
        e.body &&
        typeof e.body === "object" &&
        Array.isArray((e.body as { details?: unknown }).details)
          ? ((e.body as { details: string[] }).details)
          : [];
      if (details.length) setErros(details);
      reportApiError(e, { title: "Não foi possível emitir a NF-e" });
    } finally {
      setBusy(false);
    }
  };

  const consultar = async () => {
    setBusy(true);
    try {
      const updated = await api.post<NotaFiscal>(`/vendas/${venda.id}/nfe/consultar`, {});
      onUpdated();
      toast.success(`Status: ${statusLabel(updated.status)}`);
    } catch (e) {
      reportApiError(e, { title: "Falha ao consultar NF-e" });
    } finally {
      setBusy(false);
    }
  };

  const cancelar = async () => {
    setBusy(true);
    try {
      const updated = await api.post<NotaFiscal>(`/vendas/${venda.id}/nfe/cancelar`, {
        justificativa,
      });
      onUpdated();
      setConfirmCancel(false);
      setJustificativa("");
      toast.success(
        updated.status === "cancelada"
          ? "NF-e cancelada"
          : `Cancelamento: ${statusLabel(updated.status)}`,
      );
    } catch (e) {
      reportApiError(e, { title: "Não foi possível cancelar a NF-e" });
    } finally {
      setBusy(false);
    }
  };

  const baixar = async (kind: "danfe" | "xml") => {
    try {
      await abrirArquivo(`/vendas/${venda.id}/nfe/${kind}`);
    } catch (e) {
      reportApiError(e, { title: kind === "danfe" ? "Falha ao abrir DANFE" : "Falha ao baixar XML" });
    }
  };

  const podeEmitir =
    !nota || ["rejeitada", "cancelada", "denegada", "rascunho"].includes(nota.status);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5" />
            NF-e
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            A venda já está registrada. Emitir NF-e é opcional (só produtos, sem
            frete) e não altera o valor da ordem.
          </p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusClass(nota?.status)}`}>
          {statusLabel(nota?.status)}
        </span>
      </div>
      {nota?.numero ? (
        <p className="text-sm text-gray-700 mt-3">
          Número {nota.numero}/{nota.serie ?? "—"}
          {nota.chaveAcesso ? (
            <span className="block text-xs text-gray-500 break-all mt-1">
              Chave {nota.chaveAcesso}
            </span>
          ) : null}
        </p>
      ) : null}
      {nota?.motivoRejeicao ? (
        <p className="text-sm text-red-700 mt-2">{nota.motivoRejeicao}</p>
      ) : null}
      {erros.length > 0 ? (
        <ul className="mt-3 text-sm text-red-700 list-disc pl-5 space-y-1">
          {erros.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2 mt-4">
        {podeEmitir ? (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void emitir()}>
            {busy ? "Emitindo…" : "Emitir NF-e"}
          </button>
        ) : null}
        {nota?.status === "processando" ? (
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void consultar()}>
            Consultar status
          </button>
        ) : null}
        {nota?.status === "autorizada" ? (
          <>
            <button type="button" className="btn-secondary" onClick={() => void baixar("danfe")}>
              DANFE
            </button>
            <button type="button" className="btn-secondary" onClick={() => void baixar("xml")}>
              XML
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
            >
              Cancelar NF-e
            </button>
          </>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmCancel}
        title="Cancelar NF-e"
        description="A justificativa precisa ter ao menos 15 caracteres (regra da SEFAZ). Isso não cancela a venda."
        tone="danger"
        busy={busy}
        confirmText="Cancelar nota"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => void cancelar()}
      >
        <textarea
          className="input-field mt-3"
          rows={3}
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
          placeholder="Justificativa do cancelamento"
        />
      </ConfirmDialog>
    </div>
  );
}
