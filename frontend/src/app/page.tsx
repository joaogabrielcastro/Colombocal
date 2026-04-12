"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCartIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import { formatMoney, formatDate } from "@/lib/utils";
import api from "@/lib/api";
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
  chequesPendentes: number;
  totalChequesPendentes: number;
  totalProdutosAtivos: number;
  ultimasVendas: {
    id: number;
    dataVenda: string;
    valorTotal: number;
    cliente: { razaoSocial: string; nomeFantasia?: string | null };
    vendedor: { nome: string };
  }[];
  faturamentoPorMes: { mes: string; total: number }[];
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
    <div className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<DashboardData>("/dashboard");
      setData(d);
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Intl.DateTimeFormat("pt-BR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }).format(new Date())}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Vendas Hoje"
          value={String(d.vendasHoje)}
          sub={formatMoney(d.faturamentoHoje)}
          icon={ShoppingCartIcon}
          color="bg-blue-100 text-blue-600"
          href="/vendas"
        />
        <StatCard
          title="Faturamento do Mês"
          value={formatMoney(d.faturamentoMes)}
          sub={`${d.quantidadeVendasMes} vendas`}
          icon={ArrowTrendingUpIcon}
          color="bg-green-100 text-green-600"
          href="/relatorios/faturamento"
        />
        <StatCard
          title="Clientes Devendo"
          value={String(d.clientesDevendo)}
          sub={`Total: ${formatMoney(d.totalEmAberto)}`}
          icon={CurrencyDollarIcon}
          color={
            d.clientesDevendo > 0
              ? "bg-orange-100 text-orange-600"
              : "bg-gray-100 text-gray-500"
          }
          href="/relatorios/financeiro"
        />
        <StatCard
          title="Cheques Pendentes"
          value={String(d.chequesPendentes)}
          sub={`Total: ${formatMoney(d.totalChequesPendentes)}`}
          icon={BanknotesIcon}
          color={
            d.chequesPendentes > 0
              ? "bg-yellow-100 text-yellow-600"
              : "bg-gray-100 text-gray-500"
          }
          href="/cheques"
        />
        <StatCard
          title="Produtos Ativos"
          value={String(d.totalProdutosAtivos)}
          sub="cadastro (venda por telefone)"
          icon={CubeIcon}
          color="bg-slate-100 text-slate-600"
          href="/produtos"
        />
      </div>

      {/* Gráfico faturamento */}
      {d.faturamentoPorMes &&
        d.faturamentoPorMes.length > 0 &&
        (() => {
          const maxVal = Math.max(
            ...d.faturamentoPorMes.map((m) => m.total),
            1,
          );
          const chartH = 120;
          const barW = 36;
          const gap = 16;
          const totalW = d.faturamentoPorMes.length * (barW + gap) - gap;
          return (
            <div className="card mb-6">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">
                  Faturamento — Últimos 6 Meses
                </h2>
              </div>
              <div className="px-5 py-5 flex justify-center overflow-x-auto">
                <svg
                  width={totalW + 20}
                  height={chartH + 48}
                  style={{ minWidth: totalW + 20 }}
                >
                  {d.faturamentoPorMes.map((m, i) => {
                    const barH =
                      maxVal > 0
                        ? Math.max(
                            (m.total / maxVal) * chartH,
                            m.total > 0 ? 4 : 0,
                          )
                        : 0;
                    const x = i * (barW + gap);
                    const y = chartH - barH;
                    return (
                      <g key={m.mes}>
                        <rect
                          x={x}
                          y={y}
                          width={barW}
                          height={barH}
                          rx={4}
                          fill="#3b82f6"
                          opacity={barH === 0 ? 0.15 : 0.85}
                        />
                        {m.total > 0 && (
                          <text
                            x={x + barW / 2}
                            y={y - 4}
                            textAnchor="middle"
                            fontSize={9}
                            fill="#374151"
                            fontWeight={600}
                          >
                            {m.total >= 1000
                              ? `R$${(m.total / 1000).toFixed(1)}k`
                              : `R$${m.total.toFixed(0)}`}
                          </text>
                        )}
                        <text
                          x={x + barW / 2}
                          y={chartH + 16}
                          textAnchor="middle"
                          fontSize={10}
                          fill="#6b7280"
                        >
                          {m.mes}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          );
        })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimas vendas */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Últimas Vendas</h2>
            <Link
              href="/vendas"
              className="text-blue-600 text-sm hover:underline"
            >
              Ver todas
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {d.ultimasVendas.length === 0 ? (
              <div className="px-5 py-6">
                <EmptyState
                  title="Nenhuma venda ainda"
                  description="As vendas recentes aparecerão aqui."
                  action={
                    <Link href="/vendas/nova" className="btn-primary text-sm">
                      Nova venda
                    </Link>
                  }
                />
              </div>
            ) : (
              d.ultimasVendas.map((v) => (
                <Link
                  key={v.id}
                  href={`/vendas/${v.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {v.cliente.nomeFantasia || v.cliente.razaoSocial}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(v.dataVenda)} • {v.vendedor.nome}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-green-700">
                    {formatMoney(v.valorTotal)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
