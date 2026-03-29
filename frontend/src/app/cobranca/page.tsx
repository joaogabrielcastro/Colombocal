"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/utils";
import api from "@/lib/api";
import { CobrancaPanelSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { reportApiError } from "@/lib/report-api-error";

interface TituloCobranca {
  id: number;
  clienteId: number;
  numero?: string | null;
  vencimento: string;
  valorOriginal: unknown;
  valorPago: unknown;
  status: string;
  cliente: {
    id: number;
    razaoSocial: string;
    nomeFantasia?: string | null;
    telefone?: string | null;
  };
  venda?: { id: number; dataVenda: string } | null;
}

interface ChequeDevolvido {
  id: number;
  valor: unknown;
  numero?: string | null;
  cliente: TituloCobranca["cliente"];
  vendaId?: number | null;
}

interface FretePendente {
  id: number;
  valor: unknown;
  data: string;
  reciboEmitido: boolean;
  reciboNumero?: string | null;
  cliente: TituloCobranca["cliente"];
  venda?: { id: number } | null;
}

interface CobrancaPayload {
  resumo: {
    titulosVencidos: number;
    valorVencido: number;
    titulosVenceHoje: number;
    valorVenceHoje: number;
    chequesDevolvidos: number;
    fretesSemRecibo: number;
  };
  vencidos: TituloCobranca[];
  venceHoje: TituloCobranca[];
  proximos7Dias: TituloCobranca[];
  chequesDevolvidos: ChequeDevolvido[];
  fretesPendentesRecibo: FretePendente[];
  topInadimplentes: Array<{
    clienteId: number;
    valor: number;
    cliente?: TituloCobranca["cliente"];
  }>;
}

function valorAberto(t: TituloCobranca): number {
  return Math.max(
    0,
    parseFloat(String(t.valorOriginal)) - parseFloat(String(t.valorPago)),
  );
}

function TituloRow({ t }: { t: TituloCobranca }) {
  const aberto = valorAberto(t);
  const nome =
    t.cliente.nomeFantasia?.trim() || t.cliente.razaoSocial;
  return (
    <li className="py-2 flex flex-wrap justify-between gap-2 border-b border-gray-100 text-sm">
      <div>
        <Link
          href={`/clientes/${t.clienteId}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {nome}
        </Link>
        {t.cliente.telefone && (
          <span className="text-gray-400 ml-2">{t.cliente.telefone}</span>
        )}
        <p className="text-xs text-gray-500">
          Vence {formatDate(t.vencimento)}
          {t.numero ? ` • ${t.numero}` : ""}
          {t.venda ? (
            <>
              {" "}
              •{" "}
              <Link href={`/vendas/${t.venda.id}`} className="text-blue-600">
                Venda #{t.venda.id}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <span className="font-semibold text-gray-900 whitespace-nowrap">
        {formatMoney(aberto)}
      </span>
    </li>
  );
}

export default function CobrancaPage() {
  const [data, setData] = useState<CobrancaPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<{
    comissaoModo?: string;
    descricaoComissao?: Record<string, string>;
  } | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [c, cfg] = await Promise.all([
        api.get<CobrancaPayload>("/dashboard/cobranca"),
        api
          .get<{
            comissaoModo: string;
            descricaoComissao?: Record<string, string>;
          }>("/config")
          .catch(() => null),
      ]);
      setData(c);
      setConfig(cfg);
    } catch (e) {
      setData(null);
      reportApiError(e, {
        title: "Painel de cobrança indisponível",
        onRetry: () => void carregar(),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (loading) {
    return <CobrancaPanelSkeleton />;
  }

  if (!data) {
    return (
      <div className="p-6 max-w-lg mx-auto flex items-center min-h-[50vh]">
        <EmptyState
          title="Não foi possível carregar o painel"
          description="Confira o servidor e sua conexão."
          action={
            <button type="button" className="btn-primary" onClick={() => void carregar()}>
              Tentar novamente
            </button>
          }
        />
      </div>
    );
  }

  const { resumo } = data;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Painel de cobrança e decisão
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Títulos em aberto, cheques devolvidos e fretes sem recibo. Regras de
          comissão:{" "}
          <strong>
            {config?.comissaoModo === "caixa" ? "sobre caixa" : "na emissão"}
          </strong>
          .
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="card p-3">
          <p className="text-xs text-gray-500">Vencidos</p>
          <p className="text-lg font-bold text-red-700">{resumo.titulosVencidos}</p>
          <p className="text-xs text-gray-600">{formatMoney(resumo.valorVencido)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500">Vence hoje</p>
          <p className="text-lg font-bold text-amber-700">
            {resumo.titulosVenceHoje}
          </p>
          <p className="text-xs text-gray-600">{formatMoney(resumo.valorVenceHoje)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500">Cheques devolvidos</p>
          <p className="text-lg font-bold text-red-600">
            {resumo.chequesDevolvidos}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-gray-500">Fretes s/ recibo</p>
          <p className="text-lg font-bold text-orange-700">
            {resumo.fretesSemRecibo}
          </p>
          <Link href="/fretes?reciboEmitido=false" className="text-xs text-blue-600">
            Ver lista
          </Link>
        </div>
        <div className="card p-3 col-span-2">
          <p className="text-xs text-gray-500 mb-1">Comissão (regra atual)</p>
          <p className="text-sm text-gray-700 leading-snug">
            {config?.comissaoModo === "caixa"
              ? config?.descricaoComissao?.caixa ||
                "Proporcional ao recebido na ordem."
              : config?.descricaoComissao?.emissao ||
                "Pela emissão da ordem (valor na venda)."}
          </p>
          <Link
            href="/relatorios/comissoes"
            className="text-xs text-blue-600 mt-1 inline-block"
          >
            Relatório de comissões
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="font-semibold text-gray-900 mb-2">
            Títulos vencidos ({data.vencidos.length})
          </h2>
          {data.vencidos.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {data.vencidos.map((t) => (
                <TituloRow key={t.id} t={t} />
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-semibold text-gray-900 mb-2">
            Top inadimplentes (por valor vencido)
          </h2>
          {data.topInadimplentes.length === 0 ? (
            <p className="text-sm text-gray-400">—</p>
          ) : (
            <ul className="text-sm">
              {data.topInadimplentes.map((x) => (
                <li
                  key={x.clienteId}
                  className="py-2 flex justify-between border-b border-gray-100"
                >
                  <Link
                    href={`/clientes/${x.clienteId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {x.cliente?.nomeFantasia?.trim() ||
                      x.cliente?.razaoSocial ||
                      `#${x.clienteId}`}
                  </Link>
                  <span className="font-medium">{formatMoney(x.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-semibold text-gray-900 mb-2">Vence hoje</h2>
          {data.venceHoje.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum.</p>
          ) : (
            <ul>
              {data.venceHoje.map((t) => (
                <TituloRow key={t.id} t={t} />
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-semibold text-gray-900 mb-2">
            Próximos 7 dias
          </h2>
          {data.proximos7Dias.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {data.proximos7Dias.map((t) => (
                <TituloRow key={t.id} t={t} />
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="font-semibold text-gray-900 mb-2">
            Cheques devolvidos
          </h2>
          {data.chequesDevolvidos.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum.</p>
          ) : (
            <ul className="text-sm divide-y divide-gray-100">
              {data.chequesDevolvidos.map((ch) => (
                <li key={ch.id} className="py-2 flex justify-between gap-2">
                  <div>
                    <Link
                      href={`/clientes/${ch.cliente.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {ch.cliente.nomeFantasia || ch.cliente.razaoSocial}
                    </Link>
                    {ch.numero && (
                      <span className="text-gray-500 ml-1">#{ch.numero}</span>
                    )}
                    {ch.vendaId ? (
                      <Link
                        href={`/vendas/${ch.vendaId}`}
                        className="block text-xs text-blue-600"
                      >
                        Venda #{ch.vendaId}
                      </Link>
                    ) : null}
                  </div>
                  <span className="font-medium text-red-700">
                    {formatMoney(String(ch.valor))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/cheques" className="text-xs text-blue-600 mt-2 inline-block">
            Ir para cheques
          </Link>
        </div>

        <div className="card p-4">
          <h2 className="font-semibold text-gray-900 mb-2">
            Fretes pendentes de recibo
          </h2>
          {data.fretesPendentesRecibo.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum.</p>
          ) : (
            <ul className="text-sm divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {data.fretesPendentesRecibo.map((fr) => (
                <li key={fr.id} className="py-2 flex justify-between gap-2">
                  <div>
                    <Link
                      href={`/clientes/${fr.cliente.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {fr.cliente.nomeFantasia || fr.cliente.razaoSocial}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {formatDate(fr.data)}
                      {fr.venda ? (
                        <>
                          {" "}
                          •{" "}
                          <Link
                            href={`/vendas/${fr.venda.id}`}
                            className="text-blue-600"
                          >
                            Venda #{fr.venda.id}
                          </Link>
                        </>
                      ) : (
                        " • Sem venda"
                      )}
                    </p>
                  </div>
                  <span className="font-medium">{formatMoney(String(fr.valor))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
