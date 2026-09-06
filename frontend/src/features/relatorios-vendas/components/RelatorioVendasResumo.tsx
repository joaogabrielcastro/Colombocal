"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import {
  BanknotesIcon,
  CalculatorIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import { formatMoney, formatQuantidade } from "@/lib/utils";
import type { EvolucaoPeriodo } from "../services/evolucao";
import {
  isRepresentanteSemComissao,
  resumoComissaoVisual,
  type ResumoCliente,
  type ResumoClienteProduto,
  type ResumoProduto,
  type ResumoRepresentante,
  type SortRepKey,
} from "../services/resumo";
import type { RelatorioVendasPdfSecao } from "../services/exports";
import { RelatorioPdfSecaoButton } from "./RelatorioPdfSecaoButton";
import { RelatorioVendasEvolucaoChart } from "./RelatorioVendasEvolucaoChart";

type Props = {
  freteEnabled?: boolean;
  totalRegistros: number;
  totalFaturamento: number;
  totalFrete: number;
  evolucao: EvolucaoPeriodo;
  resumoRepresentantesOrdenado: ResumoRepresentante[];
  resumoClientes: ResumoCliente[];
  resumoProdutos: ResumoProduto[];
  resumoClienteProdutos: ResumoClienteProduto[];
  onSortRep: (key: SortRepKey) => void;
  sortIndicator: (key: SortRepKey) => string;
  onExportPdfSecao: (secao: RelatorioVendasPdfSecao) => void;
};

/** Na tela: recorte inicial. A lista inteira permanece disponível em "Ver lista completa" e no PDF. */
export const LIMITE_LISTA_ABA = 10;

function SecaoHeader({
  title,
  secao,
  onExportPdfSecao,
  extra,
}: {
  title: string;
  secao: RelatorioVendasPdfSecao;
  onExportPdfSecao: (s: RelatorioVendasPdfSecao) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {extra}
      </div>
      <RelatorioPdfSecaoButton onClick={() => onExportPdfSecao(secao)} />
    </div>
  );
}

function RodapeLista({
  visiveis,
  total,
  rotulo,
  expandido,
  onToggle,
}: {
  visiveis: number;
  total: number;
  rotulo: string;
  expandido: boolean;
  onToggle: () => void;
}) {
  if (total <= visiveis && !expandido) return null;
  if (total <= LIMITE_LISTA_ABA && !expandido) return null;
  return (
    <div className="px-4 sm:px-5 py-3 text-xs text-gray-500 border-t border-gray-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
      <span>
        Exibindo {Math.min(visiveis, total)} de {total} {rotulo}
      </span>
      {total > LIMITE_LISTA_ABA ? (
        <button
          type="button"
          onClick={onToggle}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {expandido ? "Mostrar principais" : "Ver lista completa"}
        </button>
      ) : null}
    </div>
  );
}

function NomeCurto({ nome }: { nome: string }) {
  return (
    <span className="block truncate" title={nome}>
      {nome}
    </span>
  );
}

function ParticipacaoBar({
  pct,
  destaque,
}: {
  pct: number;
  destaque?: boolean;
}) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2 min-w-[8.5rem]">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${destaque ? "bg-amber-500" : "bg-blue-600"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-14 text-right tabular-nums text-gray-600">{pct.toFixed(2)}%</span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClass,
  valueClass = "text-gray-900",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  valueClass?: string;
}) {
  return (
    <div className="card p-4 sm:p-5 flex items-start gap-3">
      <div className={`p-2.5 rounded-xl shrink-0 ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-gray-500 font-medium">{label}</p>
        <p className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums mt-0.5 ${valueClass}`}>
          {value}
        </p>
        {hint ? <p className="text-xs text-gray-400 mt-0.5">{hint}</p> : null}
      </div>
    </div>
  );
}

export function RelatorioVendasResumo({
  freteEnabled = true,
  totalRegistros,
  totalFaturamento,
  totalFrete,
  evolucao,
  resumoRepresentantesOrdenado,
  resumoClientes,
  resumoProdutos,
  resumoClienteProdutos,
  onSortRep,
  sortIndicator,
  onExportPdfSecao,
}: Props) {
  const [clientesAbertos, setClientesAbertos] = useState(false);
  const [produtosAbertos, setProdutosAbertos] = useState(false);
  const [clienteProdutosAbertos, setClienteProdutosAbertos] = useState(false);

  const clientesAba = clientesAbertos
    ? resumoClientes
    : resumoClientes.slice(0, LIMITE_LISTA_ABA);
  const produtosAba = produtosAbertos
    ? resumoProdutos
    : resumoProdutos.slice(0, LIMITE_LISTA_ABA);
  const clienteProdutosAba = clienteProdutosAbertos
    ? resumoClienteProdutos
    : resumoClienteProdutos.slice(0, LIMITE_LISTA_ABA);

  const ticketMedio = totalRegistros > 0 ? totalFaturamento / totalRegistros : 0;
  const comissao = resumoComissaoVisual(resumoRepresentantesOrdenado, totalFaturamento);
  const kpiCols = [
    true,
    true,
    freteEnabled,
    true,
    comissao.temSemComissao,
    comissao.temSemComissao,
  ].filter(Boolean).length;

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-3 print:hidden">
        <p className="text-sm text-gray-500">Indicadores do período filtrado</p>
        <RelatorioPdfSecaoButton
          label="PDF resumo"
          onClick={() => onExportPdfSecao("totais")}
        />
      </div>
      <div
        className={`grid gap-4 lg:gap-5 mb-5 ${
          kpiCols >= 6
            ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
            : freteEnabled
              ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-3"
        }`}
      >
        <KpiCard
          label="Vendas no período"
          value={String(totalRegistros)}
          icon={ClipboardDocumentListIcon}
          iconClass="bg-slate-100 text-slate-700"
        />
        <KpiCard
          label="Total vendido"
          value={formatMoney(totalFaturamento)}
          icon={BanknotesIcon}
          iconClass="bg-emerald-50 text-emerald-700"
          valueClass="text-green-700"
        />
        {freteEnabled ? (
          <KpiCard
            label="Frete total"
            value={formatMoney(totalFrete)}
            icon={TruckIcon}
            iconClass="bg-indigo-50 text-indigo-700"
            valueClass="text-indigo-700"
          />
        ) : null}
        <KpiCard
          label="Ticket médio"
          value={totalRegistros > 0 ? formatMoney(ticketMedio) : "—"}
          icon={CalculatorIcon}
          iconClass="bg-blue-50 text-blue-700"
          valueClass="text-blue-600"
        />
        {comissao.temSemComissao ? (
          <>
            <KpiCard
              label="Vendas com comissão"
              value={formatMoney(comissao.totalCom)}
              hint={`${comissao.quantidadeCom} venda(s)`}
              icon={BanknotesIcon}
              iconClass="bg-slate-100 text-slate-600"
            />
            <KpiCard
              label="Vendas sem comissão"
              value={formatMoney(comissao.totalSem)}
              hint={`${comissao.participacaoSem.toFixed(2)}% do faturamento`}
              icon={ExclamationTriangleIcon}
              iconClass="bg-amber-50 text-amber-700"
              valueClass="text-amber-800"
            />
          </>
        ) : null}
      </div>

      {comissao.temSemComissao ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Vendas sem comissão</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Categoria já existente no agrupamento por representante — sem regra nova de cálculo.
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-amber-900 tabular-nums">
              {formatMoney(comissao.totalSem)}
            </p>
            <p className="text-xs text-amber-800 tabular-nums">
              {comissao.participacaoSem.toFixed(2)}% das vendas
            </p>
          </div>
        </div>
      ) : null}

      <RelatorioVendasEvolucaoChart evolucao={evolucao} />

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 lg:gap-5 mb-5">
        <div className="card overflow-hidden lg:col-span-2 2xl:col-span-1">
          <SecaoHeader
            title="Por Representante (Completo)"
            secao="representantes"
            onExportPdfSecao={onExportPdfSecao}
            extra={
              comissao.temSemComissao ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  Com comissão {formatMoney(comissao.totalCom)} · Sem comissão {formatMoney(comissao.totalSem)}
                </p>
              ) : null
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50/80">
                  <th className="table-header text-left px-4 py-3">
                    <button type="button" onClick={() => onSortRep("nome")} className="hover:underline">
                      Representante{sortIndicator("nome")}
                    </button>
                  </th>
                  <th className="table-header text-right px-4 py-3">
                    <button type="button" onClick={() => onSortRep("quantidade")} className="hover:underline">
                      Qtd{sortIndicator("quantidade")}
                    </button>
                  </th>
                  <th className="table-header text-left px-4 py-3 min-w-[11rem]">
                    <button type="button" onClick={() => onSortRep("participacao")} className="hover:underline">
                      Participação{sortIndicator("participacao")}
                    </button>
                  </th>
                  <th className="table-header text-right px-4 py-3">
                    <button type="button" onClick={() => onSortRep("total")} className="hover:underline">
                      Total{sortIndicator("total")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {resumoRepresentantesOrdenado.map((r, i) => {
                  const sem = isRepresentanteSemComissao(r.nome);
                  return (
                    <tr key={`${r.nome}-${i}`} className={`table-row ${sem ? "bg-amber-50/70" : ""}`}>
                      <td className="table-cell px-4 py-3 font-medium">
                        <span className={sem ? "text-amber-900" : ""}>{r.nome}</span>
                        {sem ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                            Sem comissão
                          </span>
                        ) : null}
                      </td>
                      <td className="table-cell text-right px-4 py-3 text-gray-500 tabular-nums">
                        {r.quantidade}
                      </td>
                      <td className="table-cell px-4 py-3">
                        <ParticipacaoBar pct={r.participacao} destaque={sem} />
                      </td>
                      <td className="table-cell text-right px-4 py-3 font-semibold tabular-nums">
                        {formatMoney(r.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <SecaoHeader
            title="Por Cliente"
            secao="clientes"
            onExportPdfSecao={onExportPdfSecao}
            extra={
              <p className="text-xs text-gray-500 mt-0.5">
                {resumoClientes.length > LIMITE_LISTA_ABA && !clientesAbertos
                  ? `Principais ${Math.min(LIMITE_LISTA_ABA, resumoClientes.length)}`
                  : `${resumoClientes.length} cliente(s)`}
              </p>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[320px]">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50/80">
                  <th className="table-header text-left px-4 py-3">Cliente</th>
                  <th className="table-header text-right px-4 py-3 w-12">Qtd</th>
                  <th className="table-header text-right px-4 py-3 w-[7.5rem]">Total</th>
                </tr>
              </thead>
              <tbody>
                {clientesAba.map((c, i) => (
                  <tr key={`${c.nome}-${i}`} className="table-row">
                    <td className="table-cell px-4 py-3 font-medium">
                      <NomeCurto nome={c.nome} />
                      <p className="text-[11px] text-gray-500 tabular-nums font-normal mt-0.5">
                        {(c.participacao ?? 0).toFixed(2)}% do faturamento
                      </p>
                    </td>
                    <td className="table-cell text-right px-4 py-3 text-gray-500 tabular-nums">
                      {c.quantidade}
                    </td>
                    <td className="table-cell text-right px-4 py-3 font-semibold tabular-nums">
                      {formatMoney(c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RodapeLista
            visiveis={clientesAba.length}
            total={resumoClientes.length}
            rotulo="clientes"
            expandido={clientesAbertos}
            onToggle={() => setClientesAbertos((v) => !v)}
          />
        </div>

        <div className="card overflow-hidden lg:col-span-2 2xl:col-span-1">
          <SecaoHeader
            title="Por Produto"
            secao="produtos"
            onExportPdfSecao={onExportPdfSecao}
          />
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[320px]">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50/80">
                  <th className="table-header text-left px-4 py-3">Produto</th>
                  <th className="table-header text-right px-4 py-3 w-28">Quantidade</th>
                  <th className="table-header text-right px-4 py-3 w-[6.5rem]">Total</th>
                </tr>
              </thead>
              <tbody>
                {produtosAba.map((p, i) => (
                  <tr key={`${p.nome}-${i}`} className="table-row">
                    <td className="table-cell px-4 py-3 font-medium">
                      <NomeCurto nome={p.nome} />
                      <div className="mt-1.5 max-w-[14rem]">
                        <ParticipacaoBar pct={p.participacao ?? 0} />
                      </div>
                    </td>
                    <td className="table-cell text-right px-4 py-3 text-gray-500 tabular-nums">
                      {p.quantidade.toLocaleString("pt-BR")} {p.unidade}
                    </td>
                    <td className="table-cell text-right px-4 py-3 font-semibold tabular-nums">
                      {formatMoney(p.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RodapeLista
            visiveis={produtosAba.length}
            total={resumoProdutos.length}
            rotulo="produtos"
            expandido={produtosAbertos}
            onToggle={() => setProdutosAbertos((v) => !v)}
          />
        </div>
      </div>

      {resumoClienteProdutos.length > 0 ? (
        <div className="card overflow-hidden mb-5">
          <SecaoHeader
            title="Produtos por cliente"
            secao="clienteProdutos"
            onExportPdfSecao={onExportPdfSecao}
          />
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50/80">
                  <th className="table-header text-left px-4 py-3">Cliente</th>
                  <th className="table-header text-left px-4 py-3">Produto</th>
                  <th className="table-header text-right px-4 py-3 w-36">Quantidade</th>
                  <th className="table-header text-right px-4 py-3 w-[6.5rem]">Total</th>
                </tr>
              </thead>
              <tbody>
                {clienteProdutosAba.map((c) =>
                  c.produtos.map((p, pi) => (
                    <tr
                      key={`${c.nome}-${p.produtoNome}-${pi}`}
                      className={`table-row ${pi === 0 ? "border-t border-gray-200" : ""}`}
                    >
                      <td className="table-cell px-4 py-3 font-medium">
                        {pi === 0 ? <NomeCurto nome={c.nome} /> : ""}
                      </td>
                      <td className="table-cell px-4 py-3">
                        <NomeCurto nome={p.produtoNome} />
                      </td>
                      <td className="table-cell text-right px-4 py-3 text-gray-700 tabular-nums">
                        {formatQuantidade(p.quantidade, p.unidade)}
                      </td>
                      <td className="table-cell text-right px-4 py-3 font-semibold tabular-nums">
                        {formatMoney(p.total)}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <RodapeLista
            visiveis={clienteProdutosAba.length}
            total={resumoClienteProdutos.length}
            rotulo="clientes"
            expandido={clienteProdutosAbertos}
            onToggle={() => setClienteProdutosAbertos((v) => !v)}
          />
        </div>
      ) : null}
    </>
  );
}
