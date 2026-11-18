"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowPathIcon,
  ArrowRightIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ScaleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { formatMoney, formatDate, localDateInputValue } from "@/lib/utils";
import { VendaOrdem } from "@/components/VendaOrdem";
import { DashboardFaturamentoChart } from "@/components/DashboardFaturamentoChart";
import api from "@/lib/api";
import { tenantStorageKey } from "@/lib/auth-token";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { reportApiError } from "@/lib/report-api-error";
import { useSession } from "@/lib/session";
import { canAccessNavKey } from "@/lib/navigation";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";

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
  onboarding?: OnboardingData;
  divergenciasFinanceiras?: {
    clientesComDivergencia: number;
    tolerancia: number;
    amostra: {
      clienteId: number;
      nome: string;
      contaCorrente: number;
      titulosEmAberto: number;
      diferenca: number;
    }[];
    somaAbsDiferenca: number;
  };
}

interface OnboardingData {
  clientes: number;
  produtos: number;
  vendas: number;
  recebimentos: number;
}

/** Recorte de GET /relatorios/financeiro usado aqui (carteira de títulos). */
interface CarteiraResumo {
  totalEmAberto: number;
  totalVencido: number;
  totalAVencer: number;
  pctVencido: number;
}

/** GET /fiscal/notas/resumo */
interface FiscalResumoDashboard {
  rejeitadas: number;
  processando: number;
  denegadas: number;
  autorizadas: number;
}


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

async function carregarDashboard(): Promise<{ data: DashboardData; onboarding: OnboardingData }> {
  const d = await api.get<DashboardData>("/dashboard");
  if (d.onboarding) return { data: d, onboarding: d.onboarding };
  const [clientes, produtos, vendas, recebimentos] = await Promise.all([
    api.get<unknown>("/clientes?take=1"),
    api.get<unknown>("/produtos?take=1"),
    api.get<unknown>("/vendas?take=1"),
    api.get<unknown>("/pagamentos?take=1").catch(() => api.get<unknown>("/cheques?take=1")),
  ]);
  return {
    data: d,
    onboarding: {
      clientes: totalDaResposta(clientes),
      produtos: totalDaResposta(produtos),
      vendas: totalDaResposta(vendas),
      recebimentos: totalDaResposta(recebimentos),
    },
  };
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

function StatusVenda({ quitada, saldoOrdem }: { quitada?: boolean; saldoOrdem?: number }) {
  if (quitada) return <span className="badge badge-success">Quitada</span>;
  // saldoOrdem = valor em aberto (positivo). Sem Math.abs — convenção alinhada ao backend.
  const falta = saldoOrdem != null && saldoOrdem > 0.009 ? saldoOrdem : null;
  return (
    <span className="badge badge-warning" title={falta != null ? `Em aberto: ${formatMoney(falta)}` : undefined}>
      A receber{falta != null ? ` · ${formatMoney(falta)}` : ""}
    </span>
  );
}

type Pendencia = {
  id: string;
  tone: "danger" | "warning";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: React.ReactNode;
  href: string;
  cta: string;
};

function PendenciaRow({ p }: { p: Pendencia }) {
  const Icon = p.icon;
  return (
    <li>
      <Link
        href={p.href}
        className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50"
      >
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            p.tone === "danger" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{p.title}</p>
          <div className="mt-0.5 text-xs leading-5 text-gray-500">{p.detail}</div>
        </div>
        <span className="mt-1 hidden shrink-0 items-center gap-1 text-xs font-semibold text-blue-700 group-hover:underline sm:flex">
          {p.cta}
          <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

export default function DashboardPage() {
  const { isAdmin, navPermissions, user, session } = useSession();
  const { nfeEnabled } = useTenantFeatures();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const perm = { isAdmin, navPermissions };
  // Sem sessão carregada, permissões vazias significariam "acesso total": aguarda a sessão
  // para não consultar módulos que o usuário não pode ver (evita 403).
  const sessaoPronta = session != null;
  const podeContas = sessaoPronta && canAccessNavKey("rel_financeiro", perm);
  const podeFiscal = sessaoPronta && nfeEnabled && canAccessNavKey("fiscal", perm);
  const podeVendas = canAccessNavKey("vendas", perm);
  const podeRelVendas = canAccessNavKey("rel_vendas", perm);
  const podeVerContas = canAccessNavKey("rel_financeiro", perm);

  const hoje = localDateInputValue(new Date());
  const inicio30d = localDateInputValue(new Date(Date.now() - 29 * 86_400_000));

  const principal = useQuery({
    queryKey: ["dashboard"],
    queryFn: carregarDashboard,
    retry: 1,
  });

  // Indicadores complementares: só consultados quando o usuário tem acesso ao módulo.
  const carteira = useQuery({
    queryKey: ["dashboard", "carteira"],
    queryFn: () => api.get<CarteiraResumo>("/relatorios/financeiro?take=1"),
    enabled: podeContas,
    retry: 0,
  });
  const fiscal = useQuery({
    queryKey: ["dashboard", "fiscal", inicio30d, hoje],
    queryFn: () =>
      api.get<FiscalResumoDashboard>(`/fiscal/notas/resumo?dataInicio=${inicio30d}&dataFim=${hoje}`),
    enabled: podeFiscal,
    retry: 0,
  });

  useEffect(() => {
    if (principal.error) {
      reportApiError(principal.error, {
        title: "Não foi possível carregar o início",
        onRetry: () => void principal.refetch(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principal.error]);

  useEffect(() => {
    try {
      setOnboardingDismissed(
        window.localStorage.getItem(tenantStorageKey("colombocal_onboarding_dismissed")) === "true",
      );
    } catch {
      /* storage indisponível */
    }
  }, []);

  const atualizar = () => {
    void principal.refetch();
    if (podeContas) void carteira.refetch();
    if (podeFiscal) void fiscal.refetch();
  };

  if (principal.isLoading) return <DashboardSkeleton />;

  if (!principal.data) {
    return (
      <div className="page-container flex min-h-[50vh] max-w-lg items-center">
        <EmptyState
          title="Início indisponível"
          description="Não foi possível carregar os indicadores. Verifique a conexão e tente novamente."
          action={
            <button type="button" className="btn-primary" onClick={() => void principal.refetch()}>
              Tentar novamente
            </button>
          }
        />
      </div>
    );
  }

  const { data: d, onboarding } = principal.data;
  const etapasOnboarding = [
    { label: "Cadastrar o primeiro cliente", concluida: onboarding.clientes > 0, href: "/clientes/novo" },
    { label: "Cadastrar o primeiro produto", concluida: onboarding.produtos > 0, href: "/produtos?novo=1" },
    { label: "Registrar a primeira venda", concluida: onboarding.vendas > 0, href: "/vendas/nova" },
    { label: "Registrar o primeiro recebimento", concluida: onboarding.recebimentos > 0, href: "/financeiro/novo" },
  ];
  const onboardingConcluido = etapasOnboarding.every((e) => e.concluida);
  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const primeiroNome = (user?.name || "").trim().split(/\s+/)[0];
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const meses = d.faturamentoPorMes ?? [];
  const mesAnterior = meses.length >= 2 ? meses[meses.length - 2] : null;

  const c = carteira.data;
  const f = fiscal.data;
  const pendencias: Pendencia[] = [];
  if (c && c.totalVencido > 0.009) {
    pendencias.push({
      id: "vencidos",
      tone: "danger",
      icon: ClockIcon,
      title: `${formatMoney(c.totalVencido)} em títulos vencidos`,
      detail: `${Math.round(c.pctVencido ?? 0)}% da carteira em aberto. Priorize a cobrança pelo maior atraso.`,
      href: "/relatorios/financeiro?visao=titulos&situacao=vencidos",
      cta: "Cobrar",
    });
  }
  if (f && (f.rejeitadas > 0 || f.denegadas > 0)) {
    const n = f.rejeitadas + f.denegadas;
    pendencias.push({
      id: "nfe-rejeitadas",
      tone: "danger",
      icon: DocumentTextIcon,
      title: `${plural(n, "NF-e rejeitada ou denegada", "NF-e rejeitadas ou denegadas")} nos últimos 30 dias`,
      detail: "Veja o motivo informado pela SEFAZ, corrija o cadastro e emita novamente pela venda.",
      href: `/fiscal/notas?status=rejeitada&dataInicio=${inicio30d}&dataFim=${hoje}`,
      cta: "Revisar",
    });
  }
  if (f && f.processando > 0) {
    pendencias.push({
      id: "nfe-processando",
      tone: "warning",
      icon: ArrowPathIcon,
      title: `${plural(f.processando, "NF-e aguardando", "NF-e aguardando")} retorno da SEFAZ`,
      detail: "Abra a nota e use “Consultar” para atualizar o status.",
      href: `/fiscal/notas?status=processando&dataInicio=${inicio30d}&dataFim=${hoje}`,
      cta: "Consultar",
    });
  }
  const div = d.divergenciasFinanceiras;
  if (div && div.clientesComDivergencia > 0) {
    pendencias.push({
      id: "divergencias",
      tone: "warning",
      icon: ScaleIcon,
      title: `${plural(div.clientesComDivergencia, "cliente", "clientes")} com diferença entre conta corrente e títulos`,
      detail: (
        <>
          Cobrança oficial = títulos (vendas). Frete avulso não entra na conta do cliente. Use
          &quot;Recalcular títulos&quot; no cliente se pagamentos antigos baixaram a venda por engano.
          {div.amostra.length > 0 ? (
            <span className="mt-1 block text-gray-600">
              {div.amostra
                .slice(0, 3)
                .map((x) => `${x.nome} (títulos ${formatMoney(x.titulosEmAberto)} · conta ${formatMoney(x.contaCorrente)})`)
                .join(" • ")}
            </span>
          ) : null}
        </>
      ),
      href: div.amostra[0] ? `/clientes/${div.amostra[0].clienteId}?aba=conta` : "/relatorios/financeiro",
      cta: "Conferir",
    });
  }
  const verificandoPendencias = (podeContas && carteira.isLoading) || (podeFiscal && fiscal.isLoading);

  return (
    <div className="page-container">
      <PageHeader
        title={primeiroNome ? `${saudacao}, ${primeiroNome}` : "Início"}
        titleTestId="dashboard-title"
        subtitle={dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1)}
        actions={
          <button
            type="button"
            onClick={atualizar}
            className="btn-secondary btn-sm"
            disabled={principal.isFetching}
            title="Atualizar números"
          >
            <ArrowPathIcon className={`h-4 w-4 ${principal.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
            Atualizar
          </button>
        }
      />

      {!onboardingDismissed && !onboardingConcluido ? (
        <section className="card mb-6 p-5" aria-labelledby="onboarding-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="onboarding-title" className="card-title">Primeiros passos</h2>
              <p className="card-subtitle">Complete estas etapas para começar a operar no Colombocal.</p>
            </div>
            <button
              type="button"
              className="btn-icon h-8 w-8"
              aria-label="Dispensar primeiros passos"
              onClick={() => {
                try {
                  window.localStorage.setItem(tenantStorageKey("colombocal_onboarding_dismissed"), "true");
                } catch {
                  /* ignore */
                }
                setOnboardingDismissed(true);
              }}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {etapasOnboarding.map((etapa, index) => (
              <li key={etapa.label}>
                <Link
                  href={etapa.href}
                  className={`flex h-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                    etapa.concluida
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      etapa.concluida ? "bg-green-600 text-white" : "bg-blue-50 text-blue-800"
                    }`}
                  >
                    {etapa.concluida ? "✓" : index + 1}
                  </span>
                  {etapa.label}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-label="Indicadores" className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Faturamento hoje"
          value={formatMoney(d.faturamentoHoje)}
          hint={plural(d.vendasHoje, "venda registrada", "vendas registradas")}
          icon={CalendarDaysIcon}
          tone="brand"
          href={podeVendas ? `/vendas?dataInicio=${hoje}&dataFim=${hoje}` : undefined}
        />
        <KpiCard
          label="Faturamento do mês"
          value={formatMoney(d.faturamentoMes)}
          hint={
            <>
              {plural(d.quantidadeVendasMes, "ordem", "ordens")}
              {mesAnterior ? ` · ${mesAnterior.mes}: ${formatMoney(mesAnterior.total)}` : ""}
            </>
          }
          icon={CurrencyDollarIcon}
          tone="brand"
          href={podeRelVendas ? "/relatorios/vendas" : undefined}
        />
        <KpiCard
          label="A receber (títulos)"
          value={formatMoney(d.totalEmAberto)}
          hint={
            d.clientesDevendo > 0
              ? `${plural(d.clientesDevendo, "cliente", "clientes")} com saldo em aberto`
              : "Nenhum saldo em aberto"
          }
          icon={BanknotesIcon}
          tone={d.clientesDevendo > 0 ? "warning" : "success"}
          href={podeVerContas ? "/contas-a-receber" : undefined}
        />
        {podeContas ? (
          <KpiCard
            label="Vencido"
            value={c ? formatMoney(c.totalVencido) : "—"}
            loading={carteira.isLoading}
            hint={
              c
                ? c.totalVencido > 0.009
                  ? `${Math.round(c.pctVencido ?? 0)}% da carteira · a vencer ${formatMoney(c.totalAVencer)}`
                  : "Nenhum título em atraso"
                : carteira.isError
                  ? "Indisponível no momento"
                  : undefined
            }
            icon={ExclamationTriangleIcon}
            tone={c && c.totalVencido > 0.009 ? "danger" : "success"}
            href="/relatorios/financeiro?visao=titulos&situacao=vencidos"
          />
        ) : (
          <KpiCard
            label="Cheques registrados"
            value={String(d.chequesRegistrados)}
            hint={`Total ${formatMoney(d.totalChequesRegistrados)}`}
            icon={BanknotesIcon}
            href="/financeiro"
          />
        )}
      </section>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card flex flex-col overflow-hidden lg:col-span-2" aria-labelledby="pendencias-title">
          <div className="card-header">
            <div>
              <h2 id="pendencias-title" className="card-title">Pendências</h2>
              <p className="card-subtitle">O que precisa de ação agora</p>
            </div>
            {pendencias.length > 0 ? (
              <span className="badge badge-danger">{pendencias.length}</span>
            ) : null}
          </div>
          {pendencias.length > 0 ? (
            <ul className="flex-1 divide-y divide-gray-100">
              {pendencias.map((p) => (
                <PendenciaRow key={p.id} p={p} />
              ))}
            </ul>
          ) : verificandoPendencias ? (
            <div className="flex-1 space-y-3 p-5" aria-busy="true">
              <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
              <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
            </div>
          ) : (
            <div className="flex flex-1 items-center gap-3 px-5 py-8">
              <CheckCircleIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Nenhuma pendência</p>
                <p className="text-xs text-gray-500">
                  Verificado:{" "}
                  {[podeContas ? "títulos vencidos" : null, podeFiscal ? "NF-e com problema" : null, "divergências financeiras"]
                    .filter(Boolean)
                    .join(", ")}
                  .
                </p>
              </div>
            </div>
          )}
          <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-2.5 text-xs text-gray-500">
            {d.totalProdutosAtivos} produto{d.totalProdutosAtivos === 1 ? "" : "s"} ativo
            {d.totalProdutosAtivos === 1 ? "" : "s"} · {plural(d.chequesRegistrados, "cheque registrado", "cheques registrados")}{" "}
            ({formatMoney(d.totalChequesRegistrados)})
          </div>
        </section>

        <section className="card flex flex-col" aria-labelledby="saldos-title">
          <div className="card-header">
            <div>
              <h2 id="saldos-title" className="card-title">Maiores saldos em aberto</h2>
              <p className="card-subtitle">Clientes para priorizar na cobrança</p>
            </div>
            {podeVerContas ? (
              <Link href="/contas-a-receber" className="text-xs font-semibold text-blue-700 hover:underline">
                Ver todos
              </Link>
            ) : null}
          </div>
          <div className="flex-1">
            {(d.topClientesDevendo ?? []).length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-semibold text-green-700">Tudo em dia</p>
                <p className="mt-1 text-xs text-gray-500">Nenhum cliente com saldo em aberto.</p>
              </div>
            ) : (
              <ol className="divide-y divide-gray-100">
                {d.topClientesDevendo.map((cl, i) => {
                  const pct = d.totalEmAberto > 0 ? (cl.aberto / d.totalEmAberto) * 100 : 0;
                  return (
                    <li key={cl.id}>
                      <Link
                        href={`/clientes/${cl.id}?aba=conta`}
                        className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-gray-50"
                      >
                        <span className="w-4 text-xs font-semibold tabular-nums text-gray-400">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{cl.nome}</p>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                          {formatMoney(cl.aberto)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="card overflow-hidden lg:col-span-2" aria-labelledby="faturamento-title">
          <div className="card-header">
            <div>
              <h2 id="faturamento-title" className="card-title">Faturamento — últimos 6 meses</h2>
              <p className="card-subtitle">Total vendido por mês (sem frete)</p>
            </div>
          </div>
          {meses.length > 0 ? (
            <DashboardFaturamentoChart dados={meses} />
          ) : (
            <p className="px-5 py-10 text-center text-sm text-gray-500">Sem dados de faturamento nos últimos meses.</p>
          )}
        </section>

        <section className="card overflow-hidden lg:col-span-3" aria-labelledby="ultimas-title">
          <div className="card-header">
            <div>
              <h2 id="ultimas-title" className="card-title">Últimas vendas</h2>
              <p className="card-subtitle">Abra a ordem para ver detalhes e receber</p>
            </div>
            {podeVendas ? (
              <Link href="/vendas" className="text-xs font-semibold text-blue-700 hover:underline">
                Ver todas
              </Link>
            ) : null}
          </div>
          {d.ultimasVendas.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Nenhuma venda ainda"
                description="Registre a primeira venda. Depois, na tela da ordem, você registra o que o cliente pagou."
                action={
                  <Link href="/vendas/nova" className="btn-primary btn-sm">
                    <PlusIcon className="h-4 w-4" />
                    Nova venda
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {d.ultimasVendas.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50">
                  <VendaOrdem venda={v} size="sm" className="w-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {v.cliente.nomeFantasia || v.cliente.razaoSocial}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(v.dataVenda)} · {v.vendedor.nome}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums text-gray-900">{formatMoney(v.valorTotal)}</span>
                    <StatusVenda quitada={v.quitada} saldoOrdem={v.saldoOrdem} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
