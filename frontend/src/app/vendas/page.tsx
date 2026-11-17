'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { VendaOrdem, VendaOrdemCell } from '@/components/VendaOrdem';
import {
  formatMoney,
  formatDate,
  formatFreteReciboLinha,
  localDateInputValue,
  type Venda,
  type Vendedor,
  type Motorista,
} from '@/lib/utils';
import api from '@/lib/api';
import { ListPageSkeleton, TableListSkeleton } from '@/components/ui/skeletons';
import { reportApiError } from '@/lib/report-api-error';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/ui/page-header';
import { useTenantFeatures } from '@/hooks/useTenantFeatures';
import { NfeStatusBadge } from '@/features/nfe/status';
import {
  classStatusTituloUi,
  labelStatusTituloUi,
  statusTituloFromSaldo,
} from '@/lib/status-badges';

const pageSize = 20;

function VendasPageContent() {
  const { freteEnabled, nfeEnabled } = useTenantFeatures();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [sumFiltrado, setSumFiltrado] = useState<number | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [page, setPage] = useState(
    () => parseInt(searchParams.get('page') || '1', 10) || 1,
  );
  const [buscaInput, setBuscaInput] = useState(searchParams.get('busca') || '');
  const [buscaRapida, setBuscaRapida] = useState(searchParams.get('busca') || '');
  const [ordemInput, setOrdemInput] = useState(searchParams.get('ordem') || '');
  const [ordemFiltro, setOrdemFiltro] = useState(searchParams.get('ordem') || '');
  const [dataInicio, setDataInicio] = useState(
    searchParams.get('dataInicio') || '',
  );
  const [dataFim, setDataFim] = useState(searchParams.get('dataFim') || '');
  const [vendedorId, setVendedorId] = useState(
    searchParams.get('vendedorId') || '',
  );
  const [motoristaId, setMotoristaId] = useState(
    searchParams.get('motoristaId') || '',
  );
  const [valorMin, setValorMin] = useState(searchParams.get('valorMin') || '');
  const [valorMax, setValorMax] = useState(searchParams.get('valorMax') || '');
  const [clienteId, setClienteId] = useState(searchParams.get('clienteId') || '');
  const [maisFiltrosAbertos, setMaisFiltrosAbertos] = useState(() =>
    Boolean(
      searchParams.get('vendedorId') ||
        searchParams.get('motoristaId') ||
        searchParams.get('valorMin') ||
        searchParams.get('valorMax'),
    ),
  );
  const buscaAnteriorRef = useRef<string | null>(null);

  useEffect(() => {
    api
      .get<Vendedor[]>('/vendedores?take=500')
      .then(setVendedores)
      .catch(() => setVendedores([]));
    api
      .get<Motorista[]>('/motoristas?take=500')
      .then(setMotoristas)
      .catch(() => setMotoristas([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = buscaInput.trim();
      setBuscaRapida(next);
    }, 350);
    return () => clearTimeout(t);
  }, [buscaInput]);

  useEffect(() => {
    if (buscaAnteriorRef.current !== null && buscaAnteriorRef.current !== buscaRapida) {
      setPage(1);
    }
    buscaAnteriorRef.current = buscaRapida;
  }, [buscaRapida]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (buscaRapida) params.set('busca', buscaRapida);
    const ordemTrim = ordemFiltro.replace(/^#/, '').trim();
    if (ordemTrim) params.set('ordem', ordemTrim);
    if (dataInicio) params.set('dataInicio', dataInicio);
    if (dataFim) params.set('dataFim', dataFim);
    if (vendedorId) params.set('vendedorId', vendedorId);
    if (motoristaId) params.set('motoristaId', motoristaId);
    if (valorMin.trim()) params.set('valorMin', valorMin.trim());
    if (valorMax.trim()) params.set('valorMax', valorMax.trim());
    if (clienteId) params.set('clienteId', clienteId);
    params.set('take', String(pageSize));
    params.set('skip', String((page - 1) * pageSize));
    if (page > 1) params.set('page', String(page));

    router.replace(`/vendas${params.toString() ? `?${params.toString()}` : ''}`);

    let cancelled = false;
    setLoading(true);
    api
      .getWithMeta<Venda[]>(`/vendas?${params.toString()}`)
      .then((resp) => {
        if (cancelled) return;
        setVendas(resp.data);
        setTotal(resp.meta.totalCount ?? resp.data.length);
        setSumFiltrado(resp.meta.sumValorTotal);
      })
      .catch((e) => {
        if (cancelled) return;
        reportApiError(e, {
          title: 'Não foi possível carregar as vendas',
        });
        setVendas([]);
        setTotal(0);
        setSumFiltrado(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    buscaRapida,
    ordemFiltro,
    dataInicio,
    dataFim,
    vendedorId,
    motoristaId,
    valorMin,
    valorMax,
    clienteId,
    page,
    router,
  ]);

  const subtotalPagina = vendas.reduce(
    (acc, v) => acc + parseFloat(String(v.valorTotal)),
    0,
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const aplicarBuscaJa = () => {
    const next = buscaInput.trim();
    setBuscaRapida(next);
    setOrdemFiltro(ordemInput.replace(/^#/, '').trim());
    setPage(1);
  };

  const limparFiltros = () => {
    setBuscaInput('');
    setBuscaRapida('');
    setOrdemInput('');
    setOrdemFiltro('');
    setDataInicio('');
    setDataFim('');
    setVendedorId('');
    setMotoristaId('');
    setValorMin('');
    setValorMax('');
    setClienteId('');
    setPage(1);
    router.replace('/vendas');
  };

  const hojeIso = localDateInputValue(new Date());
  const presets = [
    { id: 'hoje', label: 'Hoje', ini: hojeIso, fim: hojeIso },
    {
      id: '7d',
      label: '7 dias',
      ini: localDateInputValue(new Date(Date.now() - 6 * 86_400_000)),
      fim: hojeIso,
    },
    {
      id: 'mes',
      label: 'Este mês',
      ini: localDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
      fim: hojeIso,
    },
  ];
  const presetAtivo = presets.find((p) => p.ini === dataInicio && p.fim === dataFim)?.id ?? null;
  const filtrosAtivos = [
    buscaRapida,
    ordemFiltro,
    dataInicio,
    dataFim,
    vendedorId,
    motoristaId,
    valorMin.trim(),
    valorMax.trim(),
    clienteId,
  ].filter(Boolean).length;
  const filtrosAvancadosAtivos = [vendedorId, motoristaId, valorMin.trim(), valorMax.trim()].filter(Boolean).length;

  return (
    <div className="page-container">
      <PageHeader
        title="Vendas"
        subtitle={
          <>
            {total} venda{total === 1 ? '' : 's'}
            {filtrosAtivos > 0 ? ' com os filtros atuais' : ''}
            {sumFiltrado != null && (
              <>
                {' · '}Total filtrado (todas as páginas):{' '}
                <span className="font-semibold tabular-nums text-gray-900">{formatMoney(sumFiltrado)}</span>
              </>
            )}
            {freteEnabled ? (
              <span className="mt-0.5 block text-xs text-gray-400">
                Frete da venda fica nesta tela.{' '}
                <Link href="/fretes" className="text-blue-700 hover:underline">
                  Fretes avulsos
                </Link>{' '}
                são orçamentos sem venda.
              </span>
            ) : null}
          </>
        }
        actions={
          <Link href="/vendas/nova" className="btn-primary">
            <PlusIcon className="h-4 w-4" /> Nova venda
          </Link>
        }
      />

      {clienteId ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
          <span>
            Filtrando vendas do cliente #{clienteId}
          </span>
          <button
            type="button"
            onClick={() => {
              setClienteId('');
              setPage(1);
            }}
            className="font-medium text-blue-700 hover:underline"
          >
            Limpar filtro de cliente
          </button>
        </div>
      ) : null}

      <FilterBar className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período rápido">
          <span className="mr-1 text-xs font-semibold text-gray-500">Período:</span>
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={presetAtivo === p.id}
              onClick={() => {
                setDataInicio(p.ini);
                setDataFim(p.fim);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                presetAtivo === p.id
                  ? 'border-blue-800 bg-blue-800 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
              }`}
            >
              {p.label}
            </button>
          ))}
          {dataInicio || dataFim ? (
            <button
              type="button"
              onClick={() => {
                setDataInicio('');
                setDataFim('');
                setPage(1);
              }}
              className="rounded-full px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Todo o período
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label htmlFor="vendas-busca" className="field-label">
              Busca (cliente, CNPJ, cidade…)
            </label>
            <div className="relative">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                id="vendas-busca"
                type="search"
                value={buscaInput}
                onChange={(e) => setBuscaInput(e.target.value)}
                className="input-field w-full pl-9"
                placeholder="Nome, fantasia, CNPJ, cidade…"
              />
            </div>
          </div>
          <div className={maisFiltrosAbertos ? undefined : 'hidden sm:block'}>
            <label htmlFor="vendas-ordem" className="field-label">Ordem (#)</label>
            <input
              id="vendas-ordem"
              type="text"
              inputMode="numeric"
              value={ordemInput}
              onChange={(e) => setOrdemInput(e.target.value.replace(/^#/, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  aplicarBuscaJa();
                }
              }}
              className="input-field font-mono w-full"
              placeholder="ex: 7 ou #7"
            />
          </div>
          <div className={maisFiltrosAbertos ? undefined : 'hidden sm:block'}>
            <label htmlFor="vendas-data-inicio" className="field-label">Data início</label>
            <input
              id="vendas-data-inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value);
                setPage(1);
              }}
              className="input-field w-full"
            />
          </div>
          <div className={maisFiltrosAbertos ? undefined : 'hidden sm:block'}>
            <label htmlFor="vendas-data-fim" className="field-label">Data fim</label>
            <input
              id="vendas-data-fim"
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value);
                setPage(1);
              }}
              className="input-field w-full"
            />
          </div>
          {maisFiltrosAbertos ? (
            <>
              <div>
                <label htmlFor="vendas-vendedor" className="field-label">Vendedor</label>
                <select
                  id="vendas-vendedor"
                  value={vendedorId}
                  onChange={(e) => {
                    setVendedorId(e.target.value);
                    setPage(1);
                  }}
                  className="input-field w-full"
                >
                  <option value="">Todos</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      {v.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="vendas-motorista" className="field-label">Motorista</label>
                <select
                  id="vendas-motorista"
                  value={motoristaId}
                  onChange={(e) => {
                    setMotoristaId(e.target.value);
                    setPage(1);
                  }}
                  className="input-field w-full"
                >
                  <option value="">Todos</option>
                  {motoristas.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="vendas-valor-min" className="field-label">Valor mín. (R$)</label>
                <input
                  id="vendas-valor-min"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorMin}
                  onChange={(e) => {
                    setValorMin(e.target.value);
                    setPage(1);
                  }}
                  className="input-field w-full"
                  placeholder="0"
                />
              </div>
              <div>
                <label htmlFor="vendas-valor-max" className="field-label">Valor máx. (R$)</label>
                <input
                  id="vendas-valor-max"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorMax}
                  onChange={(e) => {
                    setValorMax(e.target.value);
                    setPage(1);
                  }}
                  className="input-field w-full"
                  placeholder="—"
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={aplicarBuscaJa} className="btn-primary">
            <MagnifyingGlassIcon className="w-4 h-4" /> Aplicar busca
          </button>
          <button
            type="button"
            onClick={limparFiltros}
            className="btn-ghost"
            disabled={filtrosAtivos === 0}
          >
            <XMarkIcon className="w-4 h-4" />
            Limpar filtros{filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setMaisFiltrosAbertos((open) => !open)}
            aria-expanded={maisFiltrosAbertos}
            className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            {maisFiltrosAbertos ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
            {maisFiltrosAbertos ? 'Ocultar filtros' : 'Mais filtros'}
            {!maisFiltrosAbertos && filtrosAvancadosAtivos > 0 ? (
              <span className="badge badge-info">{filtrosAvancadosAtivos}</span>
            ) : null}
          </button>
        </div>
      </FilterBar>
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableListSkeleton rows={12} cols={8} />
          </div>
        ) : vendas.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Nenhuma venda encontrada"
              description="Ajuste os filtros ou registre uma nova venda."
              action={
                <Link href="/vendas/nova" className="btn-primary text-sm">
                  <PlusIcon className="w-4 h-4" /> Nova Venda
                </Link>
              }
            />
          </div>
        ) : (
          <>
          <ul className="divide-y divide-gray-100 sm:hidden" aria-label="Vendas">
            {vendas.map((v) => {
              const saldo = Math.max(0, parseFloat(String(v.saldoEmAbertoTitulos ?? 0)));
              const status = statusTituloFromSaldo(saldo, parseFloat(String(v.valorTotal ?? 0)));
              const clienteNome = v.cliente.nomeFantasia || v.cliente.razaoSocial;
              return (
                <li key={v.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <VendaOrdem venda={v} size="sm" />
                      <span className="text-xs text-gray-500">{formatDate(v.dataVenda)}</span>
                      <span className={`badge ${classStatusTituloUi(status)}`}>{labelStatusTituloUi(status)}</span>
                      {nfeEnabled ? <NfeStatusBadge status={v.notaFiscal?.status} short /> : null}
                    </div>
                    <Link href={`/vendas/${v.id}`} className="mt-1 block truncate text-sm font-medium text-gray-900">
                      {clienteNome}
                    </Link>
                    <p className="truncate text-xs text-gray-500">
                      {[v.cliente.cidade, v.vendedor.nome, freteEnabled ? v.motorista?.nome : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-sm font-semibold tabular-nums text-gray-900">{formatMoney(v.valorTotal)}</span>
                    {status !== 'quitado' ? (
                      <Link
                        href={`/financeiro/novo?clienteId=${v.clienteId}&vendaId=${v.id}&ordem=${v.numeroVenda ?? v.id}`}
                        className="btn-secondary btn-sm"
                      >
                        Receber
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[64rem] text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header whitespace-nowrap bg-slate-50 !px-2 min-w-[4.5rem]">Ordem</th>
                <th className="table-header whitespace-nowrap !px-2 min-w-[5.5rem]">Data</th>
                <th className="table-header !px-2">Cliente</th>
                <th className="table-header !px-2">Vendedor</th>
                {freteEnabled ? (
                  <th className="table-header !px-2">Motorista</th>
                ) : null}
                <th className="table-header text-center whitespace-nowrap !px-2">Itens</th>
                {freteEnabled ? (
                  <>
                <th className="table-header text-right whitespace-nowrap !px-2">Frete</th>
                <th className="table-header text-right whitespace-nowrap !px-2" title="Frete pago / recibo">
                  Recibo
                </th>
                  </>
                ) : null}
                <th className="table-header text-right whitespace-nowrap !px-2">Total</th>
                <th className="table-header whitespace-nowrap !px-2">Status</th>
                {nfeEnabled ? (
                  <th className="table-header whitespace-nowrap !px-2">NF-e</th>
                ) : null}
                <th className="table-header text-right whitespace-nowrap !px-2 sticky right-0 bg-slate-50 z-[1]">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {vendas.map((v) => {
                const saldo = Math.max(
                  0,
                  parseFloat(String(v.saldoEmAbertoTitulos ?? 0)),
                );
                const total = parseFloat(String(v.valorTotal ?? 0));
                const status = statusTituloFromSaldo(saldo, total);
                const clienteNome =
                  v.cliente.nomeFantasia || v.cliente.razaoSocial;
                const fretePagoCurto = (() => {
                  const linha = formatFreteReciboLinha(v);
                  if (linha === "Pagamento pendente") return "Pendente";
                  if (linha.startsWith("Pago em ")) return linha.replace("Pago em ", "");
                  return linha;
                })();
                return (
                <tr key={v.id} className="table-row group">
                  <VendaOrdemCell venda={v} size="sm" className="!px-2 !py-2" />
                  <td className="table-cell whitespace-nowrap !px-2 !py-2">{formatDate(v.dataVenda)}</td>
                  <td className="table-cell !px-2 !py-2">
                    <Link
                      href={`/vendas/${v.id}`}
                      className="block truncate font-medium text-gray-900 hover:text-blue-800 hover:underline"
                      title={clienteNome}
                    >
                      {clienteNome}
                    </Link>
                    {v.cliente.cidade ? (
                      <p className="text-xs text-gray-400 mt-0.5 truncate" title={v.cliente.cidade}>
                        {v.cliente.cidade}
                      </p>
                    ) : null}
                  </td>
                  <td className="table-cell !px-2 !py-2">
                    <span className="block truncate" title={v.vendedor.nome}>
                      {v.vendedor.nome}
                    </span>
                  </td>
                  {freteEnabled ? (
                  <td className="table-cell !px-2 !py-2">
                    <span className="block truncate" title={v.motorista?.nome || undefined}>
                      {v.motorista?.nome || "—"}
                    </span>
                  </td>
                  ) : null}
                  <td className="table-cell text-center tabular-nums !px-2 !py-2">
                    {v.itens?.length || 0}
                  </td>
                  {freteEnabled ? (
                    <>
                  <td className="table-cell text-right whitespace-nowrap tabular-nums !px-2 !py-2">
                    {formatMoney(v.frete)}
                  </td>
                  <td
                    className="table-cell text-right whitespace-nowrap text-gray-600 !px-2 !py-2 text-xs"
                    title={formatFreteReciboLinha(v)}
                  >
                    {fretePagoCurto}
                  </td>
                    </>
                  ) : null}
                  <td className="table-cell font-semibold text-gray-900 text-right whitespace-nowrap tabular-nums !px-2 !py-2">
                    {formatMoney(v.valorTotal)}
                  </td>
                  <td className="table-cell whitespace-nowrap !px-2 !py-2">
                    <span
                      className={`badge ${classStatusTituloUi(status)}`}
                      title={
                        status === "parcial"
                          ? `Parcial · ${formatMoney(saldo)}`
                          : undefined
                      }
                    >
                      {labelStatusTituloUi(status)}
                    </span>
                  </td>
                  {nfeEnabled ? (
                    <td className="table-cell whitespace-nowrap !px-2 !py-2">
                      <NfeStatusBadge status={v.notaFiscal?.status} />
                    </td>
                  ) : null}
                  <td className="table-cell text-right !px-2 !py-1.5 sticky right-0 bg-white group-hover:bg-gray-50 z-[1] shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.06)]">
                    <div className="inline-flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
                      {status === "quitado" ? (
                        <span
                          className="btn-sm inline-flex cursor-not-allowed items-center gap-1 rounded-lg text-gray-400"
                          title="Ordem já quitada"
                        >
                          <ArrowDownTrayIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          Receber
                        </span>
                      ) : (
                        <Link
                          href={`/financeiro/novo?clienteId=${v.clienteId}&vendaId=${v.id}&ordem=${v.numeroVenda ?? v.id}`}
                          className="btn-secondary btn-sm"
                          title={`Receber ${formatMoney(saldo)} da ordem #${v.numeroVenda ?? v.id}`}
                        >
                          <ArrowDownTrayIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          Receber
                        </Link>
                      )}
                      <Link
                        href={`/vendas/nova?clienteId=${v.clienteId}`}
                        className="btn-icon h-8 w-8"
                        title={`Nova venda para ${clienteNome}`}
                        aria-label={`Nova venda para ${clienteNome}`}
                      >
                        <DocumentDuplicateIcon className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <Link
                        href={`/vendas/${v.id}`}
                        className="btn-icon h-8 w-8"
                        title="Ver venda"
                        aria-label={`Ver venda #${v.numeroVenda ?? v.id}`}
                      >
                        <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td
                  colSpan={freteEnabled ? 8 : 5}
                  className="px-2 py-3 text-sm font-semibold text-right text-gray-600"
                >
                  Subtotal (só esta página):
                </td>
                <td className="px-2 py-3 font-bold text-gray-900 text-right whitespace-nowrap tabular-nums">
                  {formatMoney(subtotalPagina)}
                </td>
                <td colSpan={nfeEnabled ? 3 : 2} />
              </tr>
            </tfoot>
          </table>
          </div>
          </>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize}
        noun="venda" onPageChange={setPage} />
    </div>
  );
}

export default function VendasPage() {
  return (
    <Suspense fallback={<ListPageSkeleton tableRows={12} />}>
      <VendasPageContent />
    </Suspense>
  );
}
