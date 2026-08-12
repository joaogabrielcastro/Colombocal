"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TableListSkeleton } from "@/components/ui/skeletons";
import { useExportCsvAsync } from "@/features/relatorios-shared/hooks/useExportCsvAsync";
import { useRelatorioVendasLookups } from "@/features/relatorios-vendas/hooks/useRelatorioVendasLookups";
import { useRelatorioVendasQuery } from "@/features/relatorios-vendas/hooks/useRelatorioVendasQuery";
import {
  exportarRelatorioVendasCSV,
  exportarRelatorioVendasExcel,
  exportarRelatorioVendasPdfSecao,
  type RelatorioVendasPdfSecao,
} from "@/features/relatorios-vendas/services/exports";
import {
  montarResumoRelatorioVendas,
} from "@/features/relatorios-vendas/services/resumo";
import { useResumoRepresentantesSort } from "@/features/relatorios-vendas/hooks/useResumoRepresentantesSort";
import { RelatorioVendasFiltros } from "@/features/relatorios-vendas/components/RelatorioVendasFiltros";
import { RelatorioVendasResumo } from "@/features/relatorios-vendas/components/RelatorioVendasResumo";
import { RelatorioVendasDetalhes } from "@/features/relatorios-vendas/components/RelatorioVendasDetalhes";
import { localDateInputValue } from "@/lib/utils";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";

export default function RelatorioVendasPage() {
  const { freteEnabled } = useTenantFeatures();
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [busca, setBusca] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [produtoId, setProdutoId] = useState("");
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
    refetch,
  } = useRelatorioVendasQuery(filtrosAplicados, !!filtrosAplicados.dataInicio && !!filtrosAplicados.dataFim);
  const data = dataRaw ?? null;
  const {
    isExporting: exportandoCsv,
    error: erroExportacao,
    exportCsv,
  } = useExportCsvAsync({
    startPath: "/relatorios/vendas/export-async",
    maxAttempts: 90,
    pollIntervalMs: 1000,
    fallback: () => {
      if (data) {
        exportarRelatorioVendasCSV(data, dataInicio, dataFim);
      }
    },
  });
  // Default: mês corrente
  useEffect(() => {
    const hoje = new Date();
    const ini = localDateInputValue(
      new Date(hoje.getFullYear(), hoje.getMonth(), 1),
    );
    const fim = localDateInputValue(hoje);
    setDataInicio(ini);
    setDataFim(fim);
    setFiltrosAplicados((prev) => ({ ...prev, dataInicio: ini, dataFim: fim }));
  }, []);

  const exportarCSV = async () => {
    await exportCsv(filtrosAplicados);
  };

  const exportarExcel = () => {
    if (!data) return;
    exportarRelatorioVendasExcel(data, dataInicio, dataFim);
  };

  const { resumoRepresentantes, resumoClientes, resumoProdutos } = useMemo(
    () => montarResumoRelatorioVendas(data),
    [data],
  );
  const { resumoRepresentantesOrdenado, toggleRepSort, sortIndicator } = useResumoRepresentantesSort(
    resumoRepresentantes,
  );

  const exportarPdfSecao = (secao: RelatorioVendasPdfSecao) => {
    if (!data) return;
    exportarRelatorioVendasPdfSecao(secao, {
      data,
      dataInicio,
      dataFim,
      resumoRepresentantes: resumoRepresentantesOrdenado,
      resumoClientes,
      resumoProdutos,
    });
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
    void refetch();
  };

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
        {data?.totalRegistros != null && data.totalRegistros > data.vendas.length && (
          <p className="text-sm text-amber-700 mt-1">
            Exibindo {data.vendas.length} de {data.totalRegistros} vendas no período (limite 500 por consulta). Ajuste datas ou exporte em lotes.
          </p>
        )}
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
        onExportCSV={exportarCSV}
        onExportExcel={exportarExcel}
        onExportPdfSecao={exportarPdfSecao}
        exportCsvLabel={exportandoCsv ? "Gerando CSV..." : "CSV"}
        exportCsvDisabled={exportandoCsv}
      />

      {erroExportacao ? (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {erroExportacao}
        </div>
      ) : null}

      {loading && (
        <div className="card p-4">
          <TableListSkeleton rows={10} cols={6} />
        </div>
      )}

      {data && !loading && (
        <>
          <RelatorioVendasResumo
            freteEnabled={freteEnabled}
            totalRegistros={data.totalRegistros ?? data.quantidade}
            totalFaturamento={data.totalFaturamento}
            totalFrete={data.totalFrete ?? 0}
            resumoRepresentantesOrdenado={resumoRepresentantesOrdenado}
            resumoClientes={resumoClientes}
            resumoProdutos={resumoProdutos}
            onSortRep={toggleRepSort}
            sortIndicator={sortIndicator}
            onExportPdfSecao={exportarPdfSecao}
          />
          <RelatorioVendasDetalhes
            freteEnabled={freteEnabled}
            vendas={data.vendas}
            onExportPdfSecao={exportarPdfSecao}
          />
        </>
      )}
    </div>
  );
}
