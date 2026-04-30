"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatMoney, formatDate } from "@/lib/utils";
import api, { apiFetchWithMeta } from "@/lib/api";
import type { FreteMovimento } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { reportApiError } from "@/lib/report-api-error";
import { ListPageSkeleton, TableListSkeleton } from "@/components/ui/skeletons";

type FreteListRow = FreteMovimento & {
  cliente: {
    id: number;
    razaoSocial: string;
    nomeFantasia?: string | null;
  };
  venda?: {
    id: number;
    dataVenda: string;
    valorTotal: unknown;
    freteRecibo?: boolean;
  } | null;
};

type ClienteOption = {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string | null;
};

type MotoristaOption = {
  id: number;
  nome: string;
};

type ProdutoOption = {
  id: number;
  nome: string;
  ativo?: boolean;
};

function FretesContent() {
  const searchParams = useSearchParams();
  const reciboQ = searchParams.get("reciboEmitido");
  const vendaQ = searchParams.get("vendaId") || "";

  const [rows, setRows] = useState<FreteListRow[]>([]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [motoristas, setMotoristas] = useState<MotoristaOption[]>([]);
  const [produtos, setProdutos] = useState<ProdutoOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [criandoValeAvulso, setCriandoValeAvulso] = useState(false);
  const [mostrarValeAvulso, setMostrarValeAvulso] = useState(false);
  const [reciboEmitido, setReciboEmitido] = useState<string>(
    reciboQ === "true" ? "true" : reciboQ === "false" ? "false" : "",
  );
  const [vendaInput, setVendaInput] = useState(vendaQ);
  const [vendaFiltro, setVendaFiltro] = useState(vendaQ.replace(/^#/, "").trim());
  const pageSize = 50;
  const hoje = new Date().toISOString().split("T")[0];
  const [valeForm, setValeForm] = useState({
    clienteId: "",
    motoristaId: "",
    produtoId: "",
    valor: "",
    dataMovimento: hoje,
    vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    observacao: "",
  });

  const carregar = async () => {
    const params = new URLSearchParams();
    params.set("take", String(pageSize));
    params.set("skip", String((page - 1) * pageSize));
    if (reciboEmitido === "true" || reciboEmitido === "false") {
      params.set("reciboEmitido", reciboEmitido);
    }
    if (vendaFiltro) params.set("vendaId", vendaFiltro);
    setLoading(true);
    try {
      const { data, meta } = await apiFetchWithMeta<FreteListRow[]>(
        `/fretes?${params}`,
      );
      setRows(data);
      setTotal(meta.totalCount ?? data.length);
    } catch (e) {
      reportApiError(e, {
        title: "Não foi possível carregar os fretes",
        onRetry: () => void carregar(),
      });
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [page, reciboEmitido, vendaFiltro]);

  useEffect(() => {
    let ativo = true;
    api
      .get<{ clientes: ClienteOption[] }>("/clientes?ativo=true&take=500&skip=0")
      .then((r) => {
        if (!ativo) return;
        setClientes(r.clientes || []);
      })
      .catch(() => {
        if (!ativo) return;
        setClientes([]);
      });

    api
      .get<MotoristaOption[]>("/motoristas?take=500&skip=0")
      .then((r) => {
        if (!ativo) return;
        setMotoristas(Array.isArray(r) ? r : []);
      })
      .catch(() => {
        if (!ativo) return;
        setMotoristas([]);
      });

    api
      .get<ProdutoOption[]>("/produtos?ativo=true&take=500&skip=0")
      .then((r) => {
        if (!ativo) return;
        setProdutos(Array.isArray(r) ? r : []);
      })
      .catch(() => {
        if (!ativo) return;
        setProdutos([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const criarValeAvulso = async (e: React.FormEvent) => {
    e.preventDefault();
    const clienteId = Number.parseInt(valeForm.clienteId, 10);
    const valor = Number(valeForm.valor.replace(",", "."));
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      alert("Selecione o cliente para o vale.");
      return;
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    setCriandoValeAvulso(true);
    try {
      await api.post("/fretes/vale-avulso", {
        clienteId,
        motoristaId: valeForm.motoristaId ? Number.parseInt(valeForm.motoristaId, 10) : null,
        produtoId: valeForm.produtoId ? Number.parseInt(valeForm.produtoId, 10) : null,
        valor,
        dataMovimento: valeForm.dataMovimento || null,
        vencimento: valeForm.vencimento || null,
        observacao: valeForm.observacao.trim(),
      });
      alert("Vale avulso criado com sucesso.");
      setValeForm((s) => ({
        ...s,
        motoristaId: "",
        produtoId: "",
        valor: "",
        observacao: "",
      }));
      await carregar();
    } catch (e) {
      reportApiError(e, { title: "Não foi possível criar o vale avulso" });
    } finally {
      setCriandoValeAvulso(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Histórico de fretes</h1>
          <p className="text-gray-500 text-sm mt-1">
            Lista de movimentações (espelho do frete da venda). Para alterar valor ou recibo, use a{' '}
            <Link href="/vendas" className="text-blue-600 hover:underline">
              venda
            </Link>
            .
          </p>
        </div>
      </div>

      <FilterBar className="p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nº venda</label>
          <input
            type="text"
            inputMode="numeric"
            value={vendaInput}
            onChange={(e) => setVendaInput(e.target.value)}
            className="input-field font-mono min-w-32"
            placeholder="ex: 1840"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Pagamento</label>
          <select
            value={reciboEmitido}
            onChange={(e) => {
              setReciboEmitido(e.target.value);
              setPage(1);
            }}
            className="input-field min-w-44"
          >
            <option value="">Todos</option>
            <option value="true">Pago</option>
            <option value="false">Pendente</option>
          </select>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setVendaFiltro(vendaInput.replace(/^#/, "").trim());
            setPage(1);
          }}
        >
          Filtrar
        </button>
      </FilterBar>

      <div className="mb-4">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setMostrarValeAvulso((v) => !v)}
        >
          {mostrarValeAvulso ? "Fechar vale avulso" : "Novo vale avulso"}
        </button>
      </div>

      {mostrarValeAvulso && (
        <div className="card p-4 mb-4">
          <h2 className="text-base font-semibold text-gray-900">Vale avulso de frete (sem venda)</h2>
          <p className="text-xs text-gray-500 mt-1 mb-3">
            Crie um vale informando cliente, motorista e produto para cobrança posterior do cliente.
          </p>
          <form onSubmit={criarValeAvulso} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cliente</label>
            <select
              value={valeForm.clienteId}
              onChange={(e) => setValeForm((s) => ({ ...s, clienteId: e.target.value }))}
              className="input-field"
              required
            >
              <option value="">Selecione</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nomeFantasia?.trim() || c.razaoSocial}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Motorista</label>
            <select
              value={valeForm.motoristaId}
              onChange={(e) => setValeForm((s) => ({ ...s, motoristaId: e.target.value }))}
              className="input-field"
            >
              <option value="">Selecione</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Produto</label>
            <select
              value={valeForm.produtoId}
              onChange={(e) => setValeForm((s) => ({ ...s, produtoId: e.target.value }))}
              className="input-field"
            >
              <option value="">Selecione</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Valor (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={valeForm.valor}
              onChange={(e) => setValeForm((s) => ({ ...s, valor: e.target.value }))}
              className="input-field"
              placeholder="0,00"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data do frete</label>
            <input
              type="date"
              value={valeForm.dataMovimento}
              onChange={(e) => setValeForm((s) => ({ ...s, dataMovimento: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Vencimento</label>
            <input
              type="date"
              value={valeForm.vencimento}
              onChange={(e) => setValeForm((s) => ({ ...s, vencimento: e.target.value }))}
              className="input-field"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Observação</label>
            <input
              value={valeForm.observacao}
              onChange={(e) => setValeForm((s) => ({ ...s, observacao: e.target.value }))}
              className="input-field"
              placeholder="Opcional"
            />
          </div>
          <div className="md:col-span-2 lg:col-span-4">
            <button type="submit" className="btn-primary" disabled={criandoValeAvulso}>
              {criandoValeAvulso ? "Criando..." : "Criar vale avulso"}
            </button>
          </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card p-4">
          <TableListSkeleton rows={10} cols={5} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nenhum frete encontrado"
          description="Ajuste os filtros ou registre frete na venda correspondente."
          action={
            <Link href="/vendas" className="btn-secondary text-sm">
              Ir para vendas
            </Link>
          }
        />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-header">Data mov.</th>
                  <th className="table-header">Cliente</th>
                  <th className="table-header">Venda</th>
                  <th className="table-header text-right">Valor</th>
                  <th className="table-header">Frete pago</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell whitespace-nowrap">
                      {formatDate(r.data)}
                    </td>
                    <td className="table-cell">
                      <Link
                        href={`/clientes/${r.clienteId}`}
                        className="text-blue-600 hover:underline"
                      >
                        {r.cliente.nomeFantasia?.trim() ||
                          r.cliente.razaoSocial}
                      </Link>
                    </td>
                    <td className="table-cell">
                      {r.venda ? (
                        <Link
                          href={`/vendas/${r.venda.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          #{r.venda.id}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="table-cell text-right font-medium">
                      {formatMoney(r.valor)}
                    </td>
                    <td className="table-cell">
                      <span
                        className={
                          r.reciboEmitido
                            ? "text-green-700"
                            : "text-amber-700"
                        }
                      >
                        {r.reciboEmitido
                          ? r.reciboData
                            ? `Pago em ${formatDate(r.reciboData)}`
                            : "Pago"
                          : "Pendente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
            <span>Total: {total}</span>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span>
                Página {page} / {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function FretesPage() {
  return (
    <Suspense fallback={<ListPageSkeleton tableRows={10} showFilters />}>
      <FretesContent />
    </Suspense>
  );
}
