'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
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

const pageSize = 20;

function VendasPageContent() {
  const { freteEnabled } = useTenantFeatures();
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
    setPage(1);
    router.replace('/vendas');
  };

  return (
    <div className="p-6">
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
            <Link href="/fretes" className="text-blue-600 hover:underline">
              Histórico de fretes
            </Link>{' '}
            (leitura; alteração pelo cadastro da venda)
          </p>
          ) : null}
        </div>
        <Link href="/vendas/nova" className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Nova Venda
        </Link>
      </div>

      <FilterBar className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">
              Busca (cliente, CNPJ, cidade…)
            </label>
            <input
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              className="input-field"
              placeholder="Nome, fantasia, CNPJ, cidade…"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Ordem (#)
            </label>
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
              className="input-field font-mono"
              placeholder="ex: 7 ou #7"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Data início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value);
                setPage(1);
              }}
              className="input-field"
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
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Vendedor</label>
            <select
              value={vendedorId}
              onChange={(e) => {
                setVendedorId(e.target.value);
                setPage(1);
              }}
              className="input-field"
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
              className="input-field"
            >
              <option value="">Todos</option>
              {motoristas.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-36">
            <label className="block text-xs text-gray-500 mb-1">
              Valor mín. (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorMin}
              onChange={(e) => {
                setValorMin(e.target.value);
                setPage(1);
              }}
              className="input-field"
              placeholder="0"
            />
          </div>
          <div className="w-36">
            <label className="block text-xs text-gray-500 mb-1">
              Valor máx. (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorMax}
              onChange={(e) => {
                setValorMax(e.target.value);
                setPage(1);
              }}
              className="input-field"
              placeholder="—"
            />
          </div>
          <button type="button" onClick={aplicarBuscaJa} className="btn-primary">
            <MagnifyingGlassIcon className="w-4 h-4" /> Aplicar busca
          </button>
          <button
            type="button"
            onClick={limparFiltros}
            className="btn-secondary flex items-center gap-1"
          >
            <XMarkIcon className="w-4 h-4" />
            Limpar filtros
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
          <table className="w-full table-fixed min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header w-16 bg-slate-50">Ordem</th>
                <th className="table-header w-24">Data</th>
                <th className="table-header">Cliente</th>
                <th className="table-header w-28">Vendedor</th>
                <th className="table-header w-28">Motorista</th>
                <th className="table-header w-14 text-center">Itens</th>
                {freteEnabled ? (
                  <>
                <th className="table-header w-24">Frete</th>
                <th className="table-header w-28">Frete pago</th>
                  </>
                ) : null}
                <th className="table-header w-28 text-right">Total</th>
                <th className="table-header w-28">Status</th>
                <th className="table-header w-44">Ações</th>
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
                return (
                <tr key={v.id} className="table-row">
                  <VendaOrdemCell venda={v} size="sm" />
                  <td className="table-cell whitespace-nowrap">{formatDate(v.dataVenda)}</td>
                  <td className="table-cell">
                    <p className="font-medium truncate" title={v.cliente.nomeFantasia || v.cliente.razaoSocial}>
                      {v.cliente.nomeFantasia || v.cliente.razaoSocial}
                    </p>
                    {v.cliente.cidade ? (
                      <p className="text-xs text-gray-400 truncate">{v.cliente.cidade}</p>
                    ) : null}
                  </td>
                  <td className="table-cell truncate">{v.vendedor.nome}</td>
                  <td className="table-cell truncate">{v.motorista?.nome || '-'}</td>
                  <td className="table-cell text-center">
                    {v.itens?.length || 0}
                  </td>
                  {freteEnabled ? (
                    <>
                  <td className="table-cell whitespace-nowrap">{formatMoney(v.frete)}</td>
                  <td className="table-cell text-xs text-gray-600 truncate">
                    {formatFreteReciboLinha(v)}
                  </td>
                    </>
                  ) : null}
                  <td className="table-cell font-semibold text-green-700 text-right whitespace-nowrap">
                    {formatMoney(v.valorTotal)}
                  </td>
                  <td className="table-cell">
                    {status === "quitado" ? (
                      <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                        Quitado
                      </span>
                    ) : status === "parcial" ? (
                      <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                        Parcial · {formatMoney(saldo)}
                      </span>
                    ) : (
                      <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                        Em aberto
                      </span>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <Link
                        href={`/vendas/${v.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Ver
                      </Link>
                      <span className="text-gray-300">·</span>
                      <Link
                        href={`/vendas/nova?clienteId=${v.clienteId}`}
                        className="text-green-700 hover:underline"
                      >
                        Nova
                      </Link>
                      <span className="text-gray-300">·</span>
                      <Link
                        href={`/financeiro/novo?clienteId=${v.clienteId}&vendaId=${v.id}&ordem=${v.numeroVenda ?? v.id}`}
                        className="text-gray-600 hover:underline"
                      >
                        Cobrar
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
                  colSpan={freteEnabled ? 9 : 7}
                  className="px-4 py-3 text-sm font-semibold text-right text-gray-600"
                >
                  Subtotal (só esta página):
                </td>
                <td className="px-4 py-3 font-bold text-green-700 text-right whitespace-nowrap">
                  {formatMoney(subtotalPagina)}
                </td>
                <td></td>
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
