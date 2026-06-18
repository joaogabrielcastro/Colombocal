"use client";

import { ArrowDownTrayIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import type { Cliente, Produto, Vendedor } from "@/lib/utils";
import type { RelVendas } from "../types";
import {
  RELATORIO_VENDAS_PDF_SECOES,
  type RelatorioVendasPdfSecao,
} from "../services/exports";

type Props = {
  dataInicio: string;
  dataFim: string;
  busca: string;
  vendedorId: string;
  clienteId: string;
  produtoId: string;
  vendedores: Vendedor[];
  clientes: Cliente[];
  produtos: Produto[];
  data: RelVendas | null;
  setDataInicio: (v: string) => void;
  setDataFim: (v: string) => void;
  setBusca: (v: string) => void;
  setVendedorId: (v: string) => void;
  setClienteId: (v: string) => void;
  setProdutoId: (v: string) => void;
  onBuscar: () => void;
  onLimpar: () => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
  onExportPdfSecao: (secao: RelatorioVendasPdfSecao) => void;
  exportCsvLabel?: string;
  exportCsvDisabled?: boolean;
};

export function RelatorioVendasFiltros(props: Props) {
  const {
    dataInicio,
    dataFim,
    busca,
    vendedorId,
    clienteId,
    produtoId,
    vendedores,
    clientes,
    produtos,
    data,
    setDataInicio,
    setDataFim,
    setBusca,
    setVendedorId,
    setClienteId,
    setProdutoId,
    onBuscar,
    onLimpar,
    onExportCSV,
    onExportExcel,
    onExportPdfSecao,
    exportCsvLabel,
    exportCsvDisabled,
  } = props;

  return (
    <div className="card p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data Início</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data Fim</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Representante</label>
          <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className="input-field">
            <option value="">Todos</option>
            {vendedores.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Cliente</label>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="input-field">
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.nomeFantasia || c.razaoSocial}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Produto</label>
          <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className="input-field">
            <option value="">Todos</option>
            {produtos.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Busca</label>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Cliente, representante ou observação"
            className="input-field"
          />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap items-end mt-3">
        <div className="flex items-end">
          <button onClick={onBuscar} className="btn-primary">
            <MagnifyingGlassIcon className="w-4 h-4" /> Gerar
          </button>
          <button onClick={onLimpar} className="btn-secondary flex items-center gap-1">
            Limpar
          </button>
          {data && (
            <>
              <button
                onClick={onExportCSV}
                disabled={exportCsvDisabled}
                className="btn-secondary flex items-center gap-1"
              >
                <ArrowDownTrayIcon className="w-4 h-4" /> {exportCsvLabel || "CSV"}
              </button>
              <button onClick={onExportExcel} className="btn-secondary flex items-center gap-1">
                <ArrowDownTrayIcon className="w-4 h-4" /> Excel
              </button>
              <select
                className="input-field py-2 text-sm max-w-[11rem]"
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value as RelatorioVendasPdfSecao | "";
                  if (v) onExportPdfSecao(v);
                  e.target.value = "";
                }}
                aria-label="Exportar PDF por seção"
              >
                <option value="">PDF por seção…</option>
                {RELATORIO_VENDAS_PDF_SECOES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
