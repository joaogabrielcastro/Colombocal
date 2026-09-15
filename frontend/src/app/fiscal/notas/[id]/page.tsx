"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/utils";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { reportApiError } from "@/lib/report-api-error";
import { toast } from "sonner";
import { NfeStatusBadge } from "@/features/nfe/status";
import { HomologacaoBanner } from "@/features/fiscal/components/HomologacaoBanner";
import { formatChave } from "@/features/fiscal/services/query";
import type { FiscalNotaDetalhe } from "@/features/fiscal/types";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";

async function abrirArquivo(path: string, nome: string) {
  const { blob, filename } = await api.getBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || nome;
  a.target = "_blank";
  a.rel = "noopener";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function FiscalNotaDetalhePage() {
  const params = useParams();
  const id = Number(params?.id);
  const { nfeEnabled, loading: featLoading } = useTenantFeatures();
  const [data, setData] = useState<FiscalNotaDetalhe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(id) || id < 1 || !nfeEnabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<FiscalNotaDetalhe>(`/fiscal/notas/${id}`)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((err) => {
        if (!cancelled) reportApiError(err, { title: "Não foi possível carregar a NF-e." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, nfeEnabled]);

  if (featLoading || loading) {
    return (
      <div className="p-6">
        <TableListSkeleton rows={6} />
      </div>
    );
  }

  if (!nfeEnabled) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-600">Módulo NF-e desabilitado.</p>
      </div>
    );
  }

  if (!data?.nota) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-600">NF-e não encontrada.</p>
        <Link href="/fiscal/notas" className="text-sky-700 text-sm hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  const { nota, venda, fiscalItens, ambiente } = data;
  const clienteNome =
    venda?.cliente?.nomeFantasia || venda?.cliente?.razaoSocial || "—";
  const doc = venda?.cliente?.cnpj || venda?.cliente?.cpf || "—";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/fiscal/notas" className="text-sm text-sky-700 hover:underline">
            ← Notas fiscais
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            NF-e #{nota.numero ?? nota.id}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {(nota.status === "autorizada" || nota.temXml || nota.status === "cancelada") && (
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              onClick={async () => {
                try {
                  await abrirArquivo(
                    `/fiscal/notas/${nota.id}/xml`,
                    `nfe-${nota.numero || nota.id}.xml`,
                  );
                } catch (err) {
                  reportApiError(err, { title: "XML ainda não disponível." });
                }
              }}
            >
              Baixar XML
            </button>
          )}
          {(nota.status === "autorizada" || nota.temDanfe) && (
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              onClick={async () => {
                try {
                  await abrirArquivo(
                    `/fiscal/notas/${nota.id}/danfe`,
                    `danfe-${nota.numero || nota.id}.pdf`,
                  );
                } catch (err) {
                  reportApiError(err, { title: "DANFE ainda não disponível." });
                  toast.message("DANFE ainda não disponível.");
                }
              }}
            >
              Visualizar DANFE
            </button>
          )}
        </div>
      </div>

      <HomologacaoBanner ambiente={ambiente} />

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Status:</span>
          <NfeStatusBadge status={nota.status} />
        </div>
        <p>
          <span className="text-slate-500">Número:</span> {nota.numero ?? "—"}
        </p>
        <p>
          <span className="text-slate-500">Série:</span> {nota.serie ?? "—"}
        </p>
        <p>
          <span className="text-slate-500">Data de emissão:</span>{" "}
          {nota.dataReferencia ? formatDate(nota.dataReferencia) : "—"}
        </p>
        <p className="break-all">
          <span className="text-slate-500">Chave:</span>{" "}
          {nota.chaveAcesso ? formatChave(nota.chaveAcesso) : "—"}
        </p>
        <p>
          <span className="text-slate-500">Cliente:</span> {clienteNome}
        </p>
        <p>
          <span className="text-slate-500">CNPJ/CPF:</span> {doc}
        </p>
        <p>
          <span className="text-slate-500">Valor:</span> {formatMoney(nota.valor)}
        </p>
        {nota.status === "rejeitada" && nota.motivoRejeicao ? (
          <p className="text-red-700">
            <span className="text-slate-500">Motivo:</span> {nota.motivoRejeicao}
          </p>
        ) : null}
        {nota.status === "cancelada" ? (
          <>
            <p>
              <span className="text-slate-500">Cancelada em:</span>{" "}
              {nota.canceladaEm ? formatDate(nota.canceladaEm) : "—"}
            </p>
            {nota.motivoCancelamento ? (
              <p>
                <span className="text-slate-500">Motivo:</span> {nota.motivoCancelamento}
              </p>
            ) : null}
            {nota.protocolo ? (
              <p>
                <span className="text-slate-500">Protocolo:</span> {nota.protocolo}
              </p>
            ) : null}
          </>
        ) : null}
        {!nota.temXml && nota.status !== "autorizada" && nota.status !== "cancelada" ? (
          <p className="text-amber-800 text-xs">XML ainda não disponível.</p>
        ) : null}
      </div>

      {venda ? (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Venda relacionada</h2>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm space-y-2">
            <p>
              Venda{" "}
              <Link
                href={`/vendas/${venda.id}`}
                className="text-sky-700 font-medium hover:underline"
              >
                #{venda.numeroVenda ?? venda.id}
              </Link>
            </p>
            <p>Cliente: {clienteNome}</p>
            <p>Vendedor: {venda.vendedor?.nome || "—"}</p>
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-sm">
                <thead className="text-xs uppercase text-slate-500 border-b">
                  <tr>
                    <th className="py-1 text-left">Produto</th>
                    <th className="py-1 text-right">Qtd</th>
                    <th className="py-1 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {venda.itens.map((it) => (
                    <tr key={it.id} className="border-t border-slate-100">
                      <td className="py-1.5">
                        {it.produto?.codigo} — {it.produto?.nome}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{it.quantidade}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatMoney(it.quantidade * it.precoUnitario)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {fiscalItens.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Fiscal</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left">CFOP</th>
                  <th className="px-3 py-2 text-left">NCM</th>
                  <th className="px-3 py-2 text-left">CST/CSOSN</th>
                </tr>
              </thead>
              <tbody>
                {fiscalItens.map((it) => (
                  <tr key={it.numeroItem} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      {it.codigoProduto} {it.descricao}
                    </td>
                    <td className="px-3 py-2">{it.cfop || "—"}</td>
                    <td className="px-3 py-2">{it.ncm || "—"}</td>
                    <td className="px-3 py-2">{it.csosn || it.cst || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
