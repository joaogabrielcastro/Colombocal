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
} from '@heroicons/react/24/outline';
import { VendaOrdemCell } from '@/components/VendaOrdem';
import {
  formatMoney,
  formatDate,
  formatFreteReciboLinha,
  type Venda,
  type Vendedor,
  type Motorista,
} from '@/lib/utils';
import api from '@/lib/api';
import { ListPageSkeleton, TableListSkeleton } from '@/components/ui/skeletons';
import { reportApiError } from '@/lib/report-api-error';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { useTenantFeatures } from '@/hooks/useTenantFeatures';
import { NfeStatusBadge } from '@/features/nfe/status';

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

  return (
    <div className="p-4 sm:p-6 lg:px-8 w-full max-w-none">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} venda{total === 1 ? '' : 's'} com os filtros atuais
            {sumFiltrado != null && (
              <>
                {' '}
                • Total filtrado (todas as páginas):{' '}
                <span className="font-semibold text-gray-800">
                  {formatMoney(sumFiltrado)}
                </span>
              </>
            )}
          </p>
          <p className="text-gray-400 text-xs mt-0.5">
            Subtotal só desta página: {formatMoney(subtotalPagina)}
          </p>
          {freteEnabled ? (
          <p className="text-gray-400 text-xs mt-1">
            Frete da venda fica nesta tela.{" "}
            <Link href="/fretes" className="text-blue-600 hover:underline">
              Fretes avulsos
            </Link>{" "}
            são orçamentos sem venda.
          </p>
          ) : null}
        </div>
        <Link href="/vendas/nova" className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Nova Venda
        </Link>
      </div>

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

      <FilterBar className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Busca (cliente, CNPJ, cidade…)
            </label>
            <input
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              className="input-field w-full"
              placeholder="Nome, fantasia, CNPJ, cidade…"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ordem (#)</label>
            <input
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value);
                setPage(1);
              }}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data fim</label>
            <input
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
                <label className="block text-xs text-gray-500 mb-1">Vendedor</label>
                <select
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
                <label className="block text-xs text-gray-500 mb-1">Motorista</label>
                <select
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
                <label className="block text-xs text-gray-500 mb-1">Valor mín. (R$)</label>
                <input
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
                <label className="block text-xs text-gray-500 mb-1">Valor máx. (R$)</label>
                <input
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
          <button type="button" onClick={aplicarBuscaJa} className="btn-primary h-10">
            <MagnifyingGlassIcon className="w-4 h-4" /> Aplicar busca
          </button>
          <button
            type="button"
            onClick={limparFiltros}
            className="btn-secondary h-10 flex items-center gap-1"
          >
            <XMarkIcon className="w-4 h-4" />
            Limpar filtros
          </button>
          <button
            type="button"
            onClick={() => setMaisFiltrosAbertos((open) => !open)}
            className="ml-auto flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {maisFiltrosAbertos ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
            {maisFiltrosAbertos ? 'Ocultar filtros' : 'Mais filtros'}
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
          <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              {freteEnabled ? (
                <>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "7%" }} />
                  {nfeEnabled ? <col style={{ width: "9%" }} /> : null}
                  <col style={{ width: nfeEnabled ? "14%" : "15%" }} />
                </>
              ) : (
                <>
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: nfeEnabled ? "20%" : "22%" }} />
                  <col style={{ width: nfeEnabled ? "14%" : "16%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  {nfeEnabled ? <col style={{ width: "10%" }} /> : null}
                  <col style={{ width: nfeEnabled ? "16%" : "16%" }} />
                </>
              )}
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header whitespace-nowrap bg-slate-50 !px-2">Ordem</th>
                <th className="table-header whitespace-nowrap !px-2">Data</th>
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
                const status =
                  saldo < 0.01
                    ? "quitado"
                    : saldo + 0.01 < total
                      ? "parcial"
                      : "em aberto";
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
                    <p className="font-medium text-gray-900 truncate" title={clienteNome}>
                      {clienteNome}
                    </p>
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
                  <td className="table-cell font-semibold text-green-700 text-right whitespace-nowrap tabular-nums !px-2 !py-2">
                    {formatMoney(v.valorTotal)}
                  </td>
                  <td className="table-cell whitespace-nowrap !px-2 !py-2">
                    {status === "quitado" ? (
                      <span className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">
                        Quitado
                      </span>
                    ) : status === "parcial" ? (
                      <span
                        className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900"
                        title={`Parcial · ${formatMoney(saldo)}`}
                      >
                        Parcial
                      </span>
                    ) : (
                      <span className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">
                        Aberto
                      </span>
                    )}
                  </td>
                  {nfeEnabled ? (
                    <td className="table-cell whitespace-nowrap !px-2 !py-2">
                      <NfeStatusBadge status={v.notaFiscal?.status} />
                    </td>
                  ) : null}
                  <td className="table-cell text-right !px-2 !py-2 sticky right-0 bg-white group-hover:bg-gray-50 z-[1] shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                    <div className="inline-flex flex-nowrap items-center justify-end gap-x-4 text-xs whitespace-nowrap">
                      <Link
                        href={`/vendas/${v.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Ver
                      </Link>
                      <Link
                        href={`/vendas/nova?clienteId=${v.clienteId}`}
                        className="text-green-700 hover:underline"
                      >
                        Nova
                      </Link>
                      <Link
                        href={`/financeiro/novo?clienteId=${v.clienteId}&vendaId=${v.id}&ordem=${v.numeroVenda ?? v.id}`}
                        className="text-gray-600 hover:underline"
                      >
                        Receber
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
                <td className="px-2 py-3 font-bold text-green-700 text-right whitespace-nowrap tabular-nums">
                  {formatMoney(subtotalPagina)}
                </td>
                <td colSpan={nfeEnabled ? 3 : 2} />
              </tr>
            </tfoot>
          </table>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <p>Total de registros (filtro): {total}</p>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
          </button>
        </div>
      </div>
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
