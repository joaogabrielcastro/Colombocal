"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCartIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
  PlusIcon,
  ArrowPathIcon,
  UserGroupIcon,
  ChartBarIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { formatMoney, formatDate } from "@/lib/utils";
import { VendaOrdem } from "@/components/VendaOrdem";
import { FluxoOperacional } from "@/components/FluxoOperacional";
import { DashboardFaturamentoChart } from "@/components/DashboardFaturamentoChart";
import api from "@/lib/api";
import { tenantStorageKey } from "@/lib/auth-token";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { reportApiError } from "@/lib/report-api-error";

interface DashboardData {
  vendasHoje: number;
  faturamentoHoje: number;
  faturamentoMes: number;
  quantidadeVendasMes: number;
  clientesDevendo: number;
  totalEmAberto: number;
  topClientesDevendo: { id: number; nome: string; aberto: number }[];
  chequesRegistrados: number;
  totalChequesRegistrados: number;
  totalProdutosAtivos: number;
  ultimasVendas: {
    id: number;
    numeroVenda?: number | null;
    dataVenda: string;
    valorTotal: number;
    totalRecebido?: number;
    saldoOrdem?: number;
    quitada?: boolean;
    cliente: { razaoSocial: string; nomeFantasia?: string | null };
    vendedor: { nome: string };
  }[];
  faturamentoPorMes: { mes: string; total: number }[];
  onboarding?: {
    clientes: number;
    produtos: number;
    vendas: number;
    recebimentos: number;
  };
}

interface OnboardingData {
  clientes: number;
  produtos: number;
  vendas: number;
  recebimentos: number;
}

const onboardingVazio: OnboardingData = {
  clientes: 0,
  produtos: 0,
  vendas: 0,
  recebimentos: 0,
};

function totalDaResposta(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    const data = value as Record<string, unknown>;
    if (typeof data.total === "number") return data.total;
    for (const key of ["clientes", "produtos", "vendas", "pagamentos", "cheques"]) {
      if (Array.isArray(data[key])) return data[key].length;
    }
  }
  return 0;
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  href?: string;
}) {
  const content = (
    <div className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow h-full">
      <div className={`p-3 rounded-xl shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

function QuickAction({
  href,
  icon: Icon,
  label,
  desc,
  primary,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border p-4 transition-all h-full ${
        primary
          ? "border-blue-200 bg-blue-50 hover:bg-blue-100/80 hover:border-blue-300"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      <div
        className={`p-2.5 rounded-lg shrink-0 ${
          primary ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className={`font-semibold text-sm ${primary ? "text-blue-900" : "text-gray-900"}`}>
          {label}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</p>
      </div>
    </Link>
  );
}

function StatusVenda({ quitada, saldoOrdem }: { quitada?: boolean; saldoOrdem?: number }) {
  if (quitada) {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-100 text-green-800">
        Recebida
      </span>
    );
  }
  const falta = saldoOrdem != null ? Math.abs(saldoOrdem) : null;
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
      A receber{falta != null && falta > 0.009 ? ` · ${formatMoney(falta)}` : ""}
    </span>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingData>(onboardingVazio);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<DashboardData>("/dashboard");
      setData(d);
      if (d.onboarding) {
        setOnboarding(d.onboarding);
      } else {
        const [clientes, produtos, vendas, recebimentos] = await Promise.all([
          api.get<unknown>("/clientes?take=1"),
          api.get<unknown>("/produtos?take=1"),
          api.get<unknown>("/vendas?take=1"),
          api.get<unknown>("/pagamentos?take=1").catch(() => api.get<unknown>("/cheques?take=1")),
        ]);
        setOnboarding({
          clientes: totalDaResposta(clientes),
          produtos: totalDaResposta(produtos),
          vendas: totalDaResposta(vendas),
          recebimentos: totalDaResposta(recebimentos),
        });
      }
    } catch (e) {
      setData(null);
      reportApiError(e, {
        title: "Não foi possível carregar o dashboard",
        onRetry: () => void carregar(),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setOnboardingDismissed(
      window.localStorage.getItem(tenantStorageKey("colombocal_onboarding_dismissed")) === "true",
    );
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className="p-6 max-w-lg mx-auto flex items-center min-h-[50vh]">
        <EmptyState
          title="Dashboard indisponível"
          description="Verifique se o backend está em execução e tente novamente."
          action={
            <button type="button" className="btn-primary" onClick={() => void carregar()}>
              Tentar novamente
            </button>
          }
        />
      </div>
    );
  }

  const d = data;
  const etapasOnboarding = [
    { label: "Ter pelo menos 1 cliente", concluida: onboarding.clientes > 0, href: "/clientes/novo" },
    { label: "Ter pelo menos 1 produto", concluida: onboarding.produtos > 0, href: "/produtos/novo" },
    { label: "Registrar 1 venda", concluida: onboarding.vendas > 0, href: "/vendas/nova" },
    { label: "Registrar 1 recebimento", concluida: onboarding.recebimentos > 0, href: "/financeiro/novo" },
  ];
  const onboardingConcluido = etapasOnboarding.every((etapa) => etapa.concluida);
  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Início</h1>
          <p className="text-gray-500 text-sm mt-1 capitalize">{dataFormatada}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void carregar()}
            className="btn-secondary text-sm"
            title="Atualizar números"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Atualizar
          </button>
          <Link href="/vendas/nova" className="btn-primary text-sm">
            <PlusIcon className="w-4 h-4" />
            Nova venda
          </Link>
        </div>
      </div>

      {!onboardingDismissed && !onboardingConcluido ? (
        <section className="card mb-6 border-blue-100 bg-blue-50/40 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">Primeiros passos</h2>
              <p className="mt-1 text-sm text-gray-600">
                Complete estas etapas para começar a usar o Colombocal.
              </p>
            </div>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-700"
              aria-label="Dispensar primeiros passos"
              onClick={() => {
                window.localStorage.setItem(
                  tenantStorageKey("colombocal_onboarding_dismissed"),
                  "true",
                );
                setOnboardingDismissed(true);
              }}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {etapasOnboarding.map((etapa, index) => (
              <li key={etapa.label}>
                <Link
                  href={etapa.href}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                    etapa.concluida
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-white bg-white text-gray-700 hover:border-blue-200"
                  }`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    etapa.concluida ? "bg-green-600 text-white" : "bg-blue-100 text-blue-700"
                  }`}>
                    {etapa.concluida ? "✓" : index + 1}
                  </span>
                  {etapa.label}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <FluxoOperacional />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <QuickAction
          href="/vendas/nova"
          icon={ShoppingCartIcon}
          label="Nova venda"
          desc="Registre produtos e gere a ordem (#)"
          primary
        />
        <QuickAction
          href="/financeiro/novo"
          icon={BanknotesIcon}
          label="Registrar recebimento"
          desc="Dinheiro, PIX ou cheque na mesma tela"
        />
        <QuickAction
          href="/relatorios/financeiro"
          icon={ChartBarIcon}
          label="Quem está devendo"
          desc="Veja saldos em aberto por cliente"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Vendas hoje"
          value={String(d.vendasHoje)}
          sub={`Faturamento: ${formatMoney(d.faturamentoHoje)}`}
          icon={ShoppingCartIcon}
          color="bg-blue-100 text-blue-600"
          href="/vendas"
        />
        <StatCard
          title="Vendas do mês"
          value={formatMoney(d.faturamentoMes)}
          sub={`${d.quantidadeVendasMes} ordem${d.quantidadeVendasMes === 1 ? "" : "ns"}`}
          icon={ArrowTrendingUpIcon}
          color="bg-green-100 text-green-600"
          href="/relatorios/vendas"
        />
        <StatCard
          title="A receber (clientes)"
          value={formatMoney(d.totalEmAberto)}
          sub={
            d.clientesDevendo > 0
              ? `${d.clientesDevendo} cliente${d.clientesDevendo === 1 ? "" : "s"} com saldo`
              : "Nenhum saldo em aberto"
          }
          icon={CurrencyDollarIcon}
          color={
            d.clientesDevendo > 0
              ? "bg-orange-100 text-orange-600"
              : "bg-gray-100 text-gray-500"
          }
          href="/relatorios/financeiro"
        />
        <StatCard
          title="Cheques registrados"
          value={String(d.chequesRegistrados)}
          sub={`Total: ${formatMoney(d.totalChequesRegistrados)}`}
          icon={BanknotesIcon}
          color="bg-slate-100 text-slate-600"
          href="/financeiro"
        />
        <StatCard
          title="Produtos ativos"
          value={String(d.totalProdutosAtivos)}
          sub="Disponíveis para venda"
          icon={CubeIcon}
          color="bg-slate-100 text-slate-600"
          href="/produtos"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {d.faturamentoPorMes && d.faturamentoPorMes.length > 0 ? (
          <div className="card lg:col-span-2 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Vendas — últimos 6 meses</h2>
              <p className="text-xs text-gray-500 mt-0.5">Valor total faturado por mês</p>
            </div>
            <DashboardFaturamentoChart dados={d.faturamentoPorMes} />
          </div>
        ) : (
          <div className="card lg:col-span-2 p-6 flex items-center justify-center text-gray-400 text-sm">
            Sem dados de faturamento nos últimos meses.
          </div>
        )}

        <div className="card flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <UserGroupIcon className="w-4 h-4 text-orange-500" />
                Precisa de atenção
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Maiores saldos em aberto</p>
            </div>
            <Link
              href="/relatorios/financeiro"
              className="text-blue-600 text-xs hover:underline whitespace-nowrap"
            >
              Ver todos
            </Link>
          </div>
          <div className="flex-1 divide-y divide-gray-50">
            {(d.topClientesDevendo ?? []).length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-medium text-green-700">Tudo em dia!</p>
                <p className="text-xs text-gray-500 mt-1">
                  Nenhum cliente com saldo em aberto no momento.
                </p>
              </div>
            ) : (
              d.topClientesDevendo.map((c) => (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}?aba=conta`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 truncate pr-2">{c.nome}</p>
                  <span className="text-sm font-semibold text-orange-700 shrink-0">
                    {formatMoney(c.aberto)}
                  </span>
                </Link>
              ))
            )}
          </div>
          {d.clientesDevendo > 0 ? (
            <div className="px-5 py-3 border-t border-gray-100 bg-amber-50/50">
              <p className="text-[11px] text-amber-900 leading-snug">
                <strong>Como cobrar:</strong> abra o cliente → encontre a venda → registre a baixa
                (dinheiro/PIX) ou um cheque.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Últimas vendas</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Clique na ordem (#) para registrar pagamentos
            </p>
          </div>
          <Link href="/vendas" className="text-blue-600 text-sm hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {d.ultimasVendas.length === 0 ? (
            <div className="px-5 py-6">
              <EmptyState
                title="Nenhuma venda ainda"
                description="Comece registrando sua primeira venda. Depois, na tela da ordem, você registra o que o cliente pagou."
                action={
                  <Link href="/vendas/nova" className="btn-primary text-sm">
                    <PlusIcon className="w-4 h-4" />
                    Nova venda
                  </Link>
                }
              />
            </div>
          ) : (
            d.ultimasVendas.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <VendaOrdem venda={v} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {v.cliente.nomeFantasia || v.cliente.razaoSocial}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(v.dataVenda)} • {v.vendedor.nome}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-semibold text-green-700">
                    {formatMoney(v.valorTotal)}
                  </span>
                  <StatusVenda quitada={v.quitada} saldoOrdem={v.saldoOrdem} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
