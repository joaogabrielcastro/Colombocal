"use client";

import { useEffect, useState } from "react";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import api, { ApiError } from "@/lib/api";
import { reportApiError } from "@/lib/report-api-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { NotaFiscal, Venda } from "@/lib/utils";
import { toast } from "sonner";
import { NfeStatusBadge, nfeStatusLabel } from "@/features/nfe/status";

const JUSTIFICATIVA_MIN = 15;

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
  const [emitentes, setEmitentes] = useState<
    {
      id: number;
      cnpj: string;
      razaoSocial: string;
      nomeFantasia?: string | null;
      ambiente: string;
      padrao: boolean;
    }[]
  >([]);
  const [emitenteFiscalId, setEmitenteFiscalId] = useState("");
  const nota = venda.notaFiscal;
  const justificativaOk = justificativa.trim().length >= JUSTIFICATIVA_MIN;

  useEffect(() => {
    if (nota && !["rejeitada", "cancelada", "denegada", "rascunho"].includes(nota.status))
      return;
    void api
      .get<
        {
          id: number;
          cnpj: string;
          razaoSocial: string;
          nomeFantasia?: string | null;
          ambiente: string;
          padrao: boolean;
        }[]
      >("/config/emitentes-fiscais-opcoes")
      .then((rows) => {
        setEmitentes(rows);
        const atual =
          rows.find((r) => r.id === nota?.emitenteFiscalId) ||
          rows.find((r) => r.padrao) ||
          rows[0];
        setEmitenteFiscalId(atual ? String(atual.id) : "");
      })
      .catch(() => setEmitentes([]));
  }, [nota?.emitenteFiscalId, nota?.status]);

  // UX-021: auto-consulta enquanto processando
  useEffect(() => {
    if (nota?.status !== "processando") return;
    let cancelled = false;
    const tick = async () => {
      try {
        await api.post<NotaFiscal>(`/vendas/${venda.id}/nfe/consultar`, {});
        if (!cancelled) onUpdated();
      } catch {
        /* mantém botão manual; não spam de toast no polling */
      }
    };
    const id = window.setInterval(() => void tick(), 8000);
    const first = window.setTimeout(() => void tick(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [nota?.status, venda.id, onUpdated]);

  const emitir = async () => {
    setBusy(true);
    setErros([]);
    try {
      const valid = await api.get<{ ok: boolean; erros: string[] }>(
        `/vendas/${venda.id}/nfe/validacao?emitenteFiscalId=${emitenteFiscalId}`,
      );
      if (!valid.ok) {
        setErros(valid.erros);
        toast.error("Cadastro fiscal incompleto");
        return;
      }
      const emitted = await api.post<NotaFiscal>(
        `/vendas/${venda.id}/nfe`,
        { emitenteFiscalId: Number(emitenteFiscalId) },
        { headers: { "Idempotency-Key": globalThis.crypto.randomUUID() } },
      );
      onUpdated();
      if (emitted.status === "autorizada") toast.success("NF-e autorizada");
      else if (emitted.status === "rejeitada")
        toast.error(emitted.motivoRejeicao || "NF-e rejeitada");
      else toast.message(`NF-e: ${nfeStatusLabel(emitted.status, { short: true })}`);
    } catch (e) {
      const details =
        e instanceof ApiError &&
        e.body &&
        typeof e.body === "object" &&
        Array.isArray((e.body as { details?: unknown }).details)
          ? (e.body as { details: string[] }).details
          : [];
      if (details.length) setErros(details);
      const code =
        e instanceof ApiError &&
        e.body &&
        typeof e.body === "object" &&
        "code" in e.body
          ? String((e.body as { code?: unknown }).code || "")
          : "";
      if (code === "NFE_STATUS_INCERTO") {
        onUpdated();
        reportApiError(e, { title: "NF-e em verificação" });
      } else {
        reportApiError(e, { title: "Não foi possível emitir a NF-e" });
      }
    } finally {
      setBusy(false);
    }
  };

  const consultar = async () => {
    setBusy(true);
    try {
      const updated = await api.post<NotaFiscal>(
        `/vendas/${venda.id}/nfe/consultar`,
        {},
      );
      onUpdated();
      toast.success(`Status: ${nfeStatusLabel(updated.status, { short: true })}`);
    } catch (e) {
      reportApiError(e, { title: "Falha ao consultar NF-e" });
    } finally {
      setBusy(false);
    }
  };

  const cancelar = async () => {
    if (!justificativaOk) {
      toast.error(`A justificativa precisa ter ao menos ${JUSTIFICATIVA_MIN} caracteres.`);
      return;
    }
    setBusy(true);
    try {
      const updated = await api.post<NotaFiscal>(`/vendas/${venda.id}/nfe/cancelar`, {
        justificativa: justificativa.trim(),
      });
      onUpdated();
      setConfirmCancel(false);
      setJustificativa("");
      toast.success(
        updated.status === "cancelada"
          ? "NF-e cancelada"
          : `Cancelamento: ${nfeStatusLabel(updated.status, { short: true })}`,
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
      reportApiError(e, {
        title: kind === "danfe" ? "Falha ao abrir DANFE" : "Falha ao baixar XML",
      });
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
            A venda já está registrada. Emitir NF-e é opcional (só produtos, sem frete) e não
            altera o valor da ordem.
          </p>
        </div>
        <NfeStatusBadge status={nota?.status} short />
      </div>
      {nota?.emitenteNome ? (
        <p className="text-sm text-gray-700 mt-3">
          Emitente: {nota.emitenteNome}
          {nota.emitenteCnpj ? ` — ${nota.emitenteCnpj}` : ""}
        </p>
      ) : null}
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
      {nota?.status === "processando" ? (
        <p className="text-sm text-amber-900 mt-2" role="status">
          Aguardando retorno da SEFAZ… atualizando automaticamente.
        </p>
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
          <>
            <label className="sr-only" htmlFor={`emitente-nfe-${venda.id}`}>
              Empresa emissora
            </label>
            <select
              id={`emitente-nfe-${venda.id}`}
              className="input-field max-w-md"
              value={emitenteFiscalId}
              onChange={(e) => setEmitenteFiscalId(e.target.value)}
            >
              <option value="">Selecione a empresa emissora</option>
              {emitentes.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.nomeFantasia || row.razaoSocial} — {row.cnpj} ({row.ambiente})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !emitenteFiscalId}
              onClick={() => void emitir()}
            >
              {busy ? "Emitindo…" : "Emitir NF-e"}
            </button>
          </>
        ) : null}
        {nota?.status === "processando" ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void consultar()}
          >
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
        description={`A justificativa precisa ter ao menos ${JUSTIFICATIVA_MIN} caracteres (regra da SEFAZ). Isso não cancela a venda.`}
        tone="danger"
        busy={busy}
        confirmText="Cancelar nota"
        confirmDisabled={!justificativaOk}
        onCancel={() => {
          setConfirmCancel(false);
          setJustificativa("");
        }}
        onConfirm={() => void cancelar()}
      >
        <label
          htmlFor={`nfe-just-${venda.id}`}
          className="block text-sm font-medium text-gray-700 mt-3 mb-1"
        >
          Justificativa *
        </label>
        <textarea
          id={`nfe-just-${venda.id}`}
          className="input-field"
          rows={3}
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
          placeholder="Justificativa do cancelamento"
          aria-invalid={justificativa.length > 0 && !justificativaOk}
        />
        <p className="mt-1 text-xs text-gray-500">
          {justificativa.trim().length}/{JUSTIFICATIVA_MIN} caracteres mínimos
        </p>
      </ConfirmDialog>
    </div>
  );
}
