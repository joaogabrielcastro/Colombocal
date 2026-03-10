"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCartIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import { formatMoney, formatDate } from "@/lib/utils";
import api from "@/lib/api";

interface DashboardData {
  vendasHoje: number;
  faturamentoHoje: number;
  faturamentoMes: number;
  quantidadeVendasMes: number;
  clientesDevendo: number;
  totalEmAberto: number;
  chequesPendentes: number;
  totalChequesPendentes: number;
  estoqueBaixo: number;
  produtosEstoqueBaixo: any[];
  ultimasVendas: any[];
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

  useEffect(() => {
    api
      .get<DashboardData>("/dashboard")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-sm">Carregando...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 text-sm">
          Erro ao carregar dashboard. Verifique se o servidor está rodando.
        </div>
      </div>
    );
  }

  const d = data;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
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
          title="Estoque Baixo"
          value={String(d.estoqueBaixo)}
          sub={d.estoqueBaixo > 0 ? "produtos abaixo do mínimo" : "estoque ok"}
          icon={CubeIcon}
          color={
            d.estoqueBaixo > 0
              ? "bg-red-100 text-red-600"
              : "bg-gray-100 text-gray-500"
          }
          href="/estoque"
        />
      </div>

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
              <p className="px-5 py-4 text-gray-400 text-sm">
                Nenhuma venda registrada
              </p>
            ) : (
              d.ultimasVendas.map((v: any) => (
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

        {/* Produtos estoque baixo */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              {d.estoqueBaixo > 0 && (
                <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
              )}
              Estoque Baixo
            </h2>
            <Link
              href="/estoque"
              className="text-blue-600 text-sm hover:underline"
            >
              Ver estoque
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {d.produtosEstoqueBaixo.length === 0 ? (
              <p className="px-5 py-4 text-gray-400 text-sm">
                Todos os produtos estão com estoque adequado
              </p>
            ) : (
              d.produtosEstoqueBaixo.map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {p.nome}
                    </p>
                    <p className="text-xs text-gray-400">
                      Mínimo: {p.estoqueMinimo} {p.unidade}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-red-600">
                    {parseFloat(p.estoqueAtual).toLocaleString("pt-BR")}{" "}
                    {p.unidade}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
