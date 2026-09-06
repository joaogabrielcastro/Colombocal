"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { useRelatorioVendasLookups } from "@/features/relatorios-vendas/hooks/useRelatorioVendasLookups";
import {
  fetchVendasDetalhesCompletos,
  useRelatorioVendasQuery,
} from "@/features/relatorios-vendas/hooks/useRelatorioVendasQuery";
import {
  exportarRelatorioVendasExcel,
  exportarRelatorioVendasPdfCompleto,
  exportarRelatorioVendasPdfSecao,
  type RelatorioVendasPdfSecao,
} from "@/features/relatorios-vendas/services/exports";
import { montarResumoRelatorioVendas } from "@/features/relatorios-vendas/services/resumo";
import { evolucaoDoRelatorio } from "@/features/relatorios-vendas/services/evolucao";
import { useResumoRepresentantesSort } from "@/features/relatorios-vendas/hooks/useResumoRepresentantesSort";
import { RelatorioVendasFiltros } from "@/features/relatorios-vendas/components/RelatorioVendasFiltros";
import { RelatorioVendasResumo } from "@/features/relatorios-vendas/components/RelatorioVendasResumo";
import { RelatorioVendasDetalhes } from "@/features/relatorios-vendas/components/RelatorioVendasDetalhes";
import { localDateInputValue } from "@/lib/utils";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { EmptyState } from "@/components/ui/empty-state";

export default function RelatorioVendasPage() {
  const { freteEnabled } = useTenantFeatures();
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [busca, setBusca] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [exportando, setExportando] = useState(false);
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    dataInicio: "",
    dataFim: "",
    busca: "",
    vendedorId: "",
    motoristaId: "",
    clienteId: "",
    produtoId: "",
  });
  const { vendedores, clientes, produtos, motoristas } = useRelatorioVendasLookups();
  const {
    data: dataRaw,
    isLoading: loading,
    isFetching,
    isError,
    dataUpdatedAt,
    refetch,
  } = useRelatorioVendasQuery(
    filtrosAplicados,
    !!filtrosAplicados.dataInicio && !!filtrosAplicados.dataFim,
  );
  const data = dataRaw ?? null;

  useEffect(() => {
    const hoje = new Date();
    const ini = localDateInputValue(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    const fim = localDateInputValue(hoje);
    setDataInicio(ini);
    setDataFim(fim);
    setFiltrosAplicados((prev) => ({ ...prev, dataInicio: ini, dataFim: fim }));
  }, []);

  const { resumoRepresentantes, resumoClientes, resumoProdutos, resumoClienteProdutos } = useMemo(
    () => montarResumoRelatorioVendas(data),
    [data],
  );
  const { resumoRepresentantesOrdenado, toggleRepSort, sortIndicator } = useResumoRepresentantesSort(
    resumoRepresentantes,
  );

  const evolucao = useMemo(
    () =>
      evolucaoDoRelatorio(
        data?.evolucao,
        data?.vendas ?? [],
        filtrosAplicados.dataInicio,
        filtrosAplicados.dataFim,
      ),
    [data, filtrosAplicados.dataInicio, filtrosAplicados.dataFim],
  );

  const filtrosTexto = useMemo(() => {
    const partes: string[] = [];
    const vendedor = vendedores.find((v) => String(v.id) === filtrosAplicados.vendedorId);
    const cliente = clientes.find((c) => String(c.id) === filtrosAplicados.clienteId);
    const produto = produtos.find((p) => String(p.id) === filtrosAplicados.produtoId);
    const motorista = motoristas.find((m) => String(m.id) === filtrosAplicados.motoristaId);
    if (vendedor) partes.push(`Representante: ${vendedor.nome}`);
    if (cliente) partes.push(`Cliente: ${cliente.nomeFantasia || cliente.razaoSocial}`);
    if (produto) partes.push(`Produto: ${produto.nome}`);
    if (motorista) partes.push(`Motorista: ${motorista.nome}`);
    if (filtrosAplicados.busca.trim()) partes.push(`Busca: ${filtrosAplicados.busca.trim()}`);
    return partes.join(" · ");
  }, [vendedores, clientes, produtos, motoristas, filtrosAplicados]);

  const pdfOpts = useMemo(
    () =>
      data
        ? {
            data,
            dataInicio: filtrosAplicados.dataInicio,
            dataFim: filtrosAplicados.dataFim,
            resumoRepresentantes: resumoRepresentantesOrdenado,
            resumoClientes,
            resumoProdutos,
            resumoClienteProdutos,
            freteEnabled,
            filtrosTexto,
          }
        : null,
    [
      data,
      filtrosAplicados.dataInicio,
      filtrosAplicados.dataFim,
      resumoRepresentantesOrdenado,
      resumoClientes,
      resumoProdutos,
      resumoClienteProdutos,
      freteEnabled,
      filtrosTexto,
    ],
  );

  const comDadosCompletos = async () => {
    if (!data) return null;
    return fetchVendasDetalhesCompletos(filtrosAplicados, data);
  };

  const exportarExcel = async () => {
    if (!data) return;
    try {
      setExportando(true);
      const completo = await comDadosCompletos();
      if (!completo) return;
      exportarRelatorioVendasExcel(
        completo,
        filtrosAplicados.dataInicio,
        filtrosAplicados.dataFim,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o Excel");
    } finally {
      setExportando(false);
    }
  };

  const exportarPdfCompleto = async () => {
    if (!pdfOpts) return;
    try {
      setExportando(true);
      const completo = await comDadosCompletos();
      if (!completo) return;
      exportarRelatorioVendasPdfCompleto({ ...pdfOpts, data: completo });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o PDF");
    } finally {
      setExportando(false);
    }
  };

  const exportarPdfSecao = async (secao: RelatorioVendasPdfSecao) => {
    if (!pdfOpts) return;
    try {
      setExportando(true);
      const precisaDetalhe = secao === "detalhes";
      const completo = precisaDetalhe ? await comDadosCompletos() : data;
      if (!completo) return;
      exportarRelatorioVendasPdfSecao(secao, { ...pdfOpts, data: completo });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o PDF");
    } finally {
      setExportando(false);
    }
  };

  const buscar = (override?: Partial<typeof filtrosAplicados>) => {
    const next = {
      dataInicio,
      dataFim,
      busca,
      vendedorId,
      motoristaId,
      clienteId,
      produtoId,
      ...override,
    };
    setFiltrosAplicados(next);
  };

  const atualizadoEm =
    dataUpdatedAt > 0
      ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : null;

  return (
    <div className="p-4 sm:p-6 lg:px-8 w-full max-w-none">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Relatório de Vendas
        </h1>
        <div className="mt-2">
          <Link href="/relatorios/comissoes" className="text-sm text-blue-600 hover:underline">
            Abrir relatório de comissões (com impressão) →
          </Link>
        </div>
        {filtrosTexto ? (
          <p className="text-xs text-gray-500 mt-2">Filtros aplicados: {filtrosTexto}</p>
        ) : null}
        {atualizadoEm && data && !loading ? (
          <p className="text-xs text-gray-400 mt-1">
            {isFetching ? "Atualizando resultado..." : `Resultado atualizado às ${atualizadoEm}`}
          </p>
        ) : null}
      </div>

      <RelatorioVendasFiltros
        dataInicio={dataInicio}
        dataFim={dataFim}
        busca={busca}
        vendedorId={vendedorId}
        motoristaId={motoristaId}
        clienteId={clienteId}
        produtoId={produtoId}
        vendedores={vendedores}
        motoristas={motoristas}
        clientes={clientes}
        produtos={produtos}
        data={data}
        setDataInicio={setDataInicio}
        setDataFim={setDataFim}
        setBusca={setBusca}
        setVendedorId={setVendedorId}
        setMotoristaId={setMotoristaId}
        setClienteId={setClienteId}
        setProdutoId={setProdutoId}
        exportando={exportando}
        onBuscar={() => buscar()}
        onLimpar={() => {
          setBusca("");
          setVendedorId("");
          setMotoristaId("");
          setClienteId("");
          setProdutoId("");
          buscar({
            busca: "",
            vendedorId: "",
            motoristaId: "",
            clienteId: "",
            produtoId: "",
          });
        }}
        onExportExcel={() => void exportarExcel()}
        onExportPdfCompleto={() => void exportarPdfCompleto()}
      />

      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5 h-24 animate-pulse bg-gray-50" />
            ))}
          </div>
          <div className="card p-4">
            <TableListSkeleton rows={10} cols={6} />
          </div>
        </div>
      )}

      {isError && !loading && (
        <div className="card p-4">
          <EmptyState
            title="Não foi possível carregar o relatório"
            description="Verifique a conexão e tente novamente."
            action={
              <button type="button" className="btn-primary" onClick={() => void refetch()}>
                Tentar novamente
              </button>
            }
          />
        </div>
      )}

      {data && !loading && !isError && data.vendas.length === 0 && (data.totalRegistros ?? 0) === 0 && (
        <EmptyState
          title="Nenhuma venda encontrada para os filtros selecionados."
          description="Ajuste as datas ou os filtros e gere o relatório novamente."
        />
      )}

      {data && !loading && !isError && ((data.totalRegistros ?? data.vendas.length) > 0 || data.vendas.length > 0) && (
        <>
          <RelatorioVendasResumo
            freteEnabled={freteEnabled}
            totalRegistros={data.totalRegistros ?? data.quantidade}
            totalFaturamento={data.totalFaturamento}
            totalFrete={data.totalFrete ?? 0}
            evolucao={evolucao}
            resumoRepresentantesOrdenado={resumoRepresentantesOrdenado}
            resumoClientes={resumoClientes}
            resumoProdutos={resumoProdutos}
            resumoClienteProdutos={resumoClienteProdutos}
            onSortRep={toggleRepSort}
            sortIndicator={sortIndicator}
            onExportPdfSecao={(secao) => void exportarPdfSecao(secao)}
          />
          <RelatorioVendasDetalhes
            freteEnabled={freteEnabled}
            vendas={data.vendas}
            totalRegistros={data.totalRegistros}
            onExportPdfSecao={(secao) => void exportarPdfSecao(secao)}
          />
        </>
      )}
    </div>
  );
}
