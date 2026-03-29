'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatMoney, formatDate, formatFreteReciboLinha, type Venda } from '@/lib/utils';
import api from '@/lib/api';
import { ListPageSkeleton, TableListSkeleton } from '@/components/ui/skeletons';
import { reportApiError } from '@/lib/report-api-error';

function VendasPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const [page, setPage] = useState(() => parseInt(searchParams.get('page') || '1', 10) || 1);
  const [buscaInput, setBuscaInput] = useState(searchParams.get('busca') || '');
  const [buscaRapida, setBuscaRapida] = useState(searchParams.get('busca') || '');
  const [dataInicio, setDataInicio] = useState(searchParams.get('dataInicio') || '');
  const [dataFim, setDataFim] = useState(searchParams.get('dataFim') || '');

  const carregar = async () => {
    const params = new URLSearchParams();
    if (buscaRapida) params.set('busca', buscaRapida);
    if (dataInicio) params.set('dataInicio', dataInicio);
    if (dataFim) params.set('dataFim', dataFim);
    params.set('take', String(pageSize));
    params.set('skip', String((page - 1) * pageSize));
    setLoading(true);
    try {
      const resp = await api.getWithMeta<Venda[]>(`/vendas?${params.toString()}`);
      setVendas(resp.data);
      setTotal(resp.meta.totalCount ?? resp.data.length);
    } catch (e) {
      reportApiError(e, {
        title: 'Não foi possível carregar as vendas',
        onRetry: () => void carregar(),
      });
      setVendas([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaRapida(buscaInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [buscaInput]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (buscaRapida) params.set('busca', buscaRapida);
    if (dataInicio) params.set('dataInicio', dataInicio);
    if (dataFim) params.set('dataFim', dataFim);
    if (page > 1) params.set('page', String(page));
    router.replace(`/vendas${params.toString() ? `?${params.toString()}` : ''}`);
    carregar();
  }, [buscaRapida, dataInicio, dataFim, page]);

  const totalFaturamento = vendas.reduce((acc, v) => acc + parseFloat(String(v.valorTotal)), 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendas</h1>
          <p className="text-gray-500 text-sm mt-1">{vendas.length} vendas • Total: {formatMoney(totalFaturamento)}</p>
        </div>
        <Link href="/vendas/nova" className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Nova Venda
        </Link>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-[2] min-w-56">
            <label className="block text-xs text-gray-500 mb-1">Busca rápida (cliente/telefone/CNPJ)</label>
            <input
              value={buscaInput}
              onChange={e => setBuscaInput(e.target.value)}
              className="input-field"
              placeholder="Digite nome, telefone, CNPJ..."
            />
          </div>
          <div className="flex-1 min-w-32">
            <label className="block text-xs text-gray-500 mb-1">Data Início</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="input-field" />
          </div>
          <div className="flex-1 min-w-32">
            <label className="block text-xs text-gray-500 mb-1">Data Fim</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="input-field" />
          </div>
          <div className="flex items-end">
            <button onClick={() => { setPage(1); carregar(); }} className="btn-primary">
              <MagnifyingGlassIcon className="w-4 h-4" /> Filtrar
            </button>
          </div>
        </div>
      </div>
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableListSkeleton rows={12} cols={8} />
          </div>
        ) : vendas.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhuma venda encontrada</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">#</th>
                <th className="table-header">Data</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Vendedor</th>
                <th className="table-header">Motorista</th>
                <th className="table-header">Itens</th>
                <th className="table-header">Frete</th>
                <th className="table-header">Recibo frete</th>
                <th className="table-header">Total</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {vendas.map(v => (
                <tr key={v.id} className="table-row">
                  <td className="table-cell text-gray-400 font-mono">#{v.id}</td>
                  <td className="table-cell">{formatDate(v.dataVenda)}</td>
                  <td className="table-cell">
                    <p className="font-medium">{v.cliente.nomeFantasia || v.cliente.razaoSocial}</p>
                    <p className="text-xs text-gray-400">{v.cliente.cidade}</p>
                  </td>
                  <td className="table-cell">{v.vendedor.nome}</td>
                  <td className="table-cell">{v.motorista?.nome || '-'}</td>
                  <td className="table-cell text-center">{v.itens?.length || 0}</td>
                  <td className="table-cell">{formatMoney(v.frete)}</td>
                  <td className="table-cell text-xs text-gray-600 max-w-[10rem]">
                    {formatFreteReciboLinha(v)}
                  </td>
                  <td className="table-cell font-semibold text-green-700">{formatMoney(v.valorTotal)}</td>
                  <td className="table-cell">
                    <div className="flex flex-col gap-1">
                      <Link href={`/vendas/${v.id}`} className="text-blue-600 hover:underline text-sm font-medium">Ver</Link>
                      <Link href={`/vendas/nova?clienteId=${v.clienteId}`} className="text-xs text-green-700 hover:underline">Nova venda</Link>
                      <Link href={`/clientes/${v.clienteId}?aba=cheques`} className="text-xs text-gray-600 hover:underline">Cobrar cliente</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td colSpan={8} className="px-4 py-3 text-sm font-semibold text-right text-gray-600">Total:</td>
                <td className="px-4 py-3 font-bold text-green-700">{formatMoney(totalFaturamento)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <p>Total de registros: {total}</p>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <span>Página {page} de {totalPages}</span>
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
