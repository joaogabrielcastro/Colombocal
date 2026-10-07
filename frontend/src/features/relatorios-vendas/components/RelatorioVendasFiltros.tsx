"use client";

import { useState } from "react";
import {
  ArrowDownTrayIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import type { Cliente, Produto, Vendedor, Motorista } from "@/lib/utils";
import type { RelVendas } from "../types";

type Props = {
  dataInicio: string;
  dataFim: string;
  busca: string;
  vendedorId: string;
  motoristaId: string;
  clienteId: string;
  produtoId: string;
  produtoBusca: string;
  vendedores: Vendedor[];
  motoristas: Motorista[];
  clientes: Cliente[];
  produtos: Produto[];
  data: RelVendas | null;
  setDataInicio: (v: string) => void;
  setDataFim: (v: string) => void;
  setBusca: (v: string) => void;
  setVendedorId: (v: string) => void;
  setMotoristaId: (v: string) => void;
  setClienteId: (v: string) => void;
  setProdutoId: (v: string) => void;
  setProdutoBusca: (v: string) => void;
  onBuscar: () => void;
  onLimpar: () => void;
  onExportExcel: () => void;
  onExportPdfCompleto: () => void;
  exportando?: boolean;
};

export function RelatorioVendasFiltros(props: Props) {
  const {
    dataInicio,
    dataFim,
    busca,
    vendedorId,
    motoristaId,
    clienteId,
    produtoId,
    produtoBusca,
    vendedores,
    motoristas,
    clientes,
    produtos,
    data,
    setDataInicio,
    setDataFim,
    setBusca,
    setVendedorId,
    setMotoristaId,
    setClienteId,
    setProdutoId,
    setProdutoBusca,
    onBuscar,
    onLimpar,
    onExportExcel,
    onExportPdfCompleto,
    exportando = false,
  } = props;

  const [maisFiltrosAbertos, setMaisFiltrosAbertos] = useState(
    () => Boolean(clienteId || produtoId || produtoBusca || motoristaId),
  );

  return (
    <div className="card p-4 sm:p-5 mb-6 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <label htmlFor="rel-vendas-inicio" className="field-label">Data inicial</label>
          <input
            id="rel-vendas-inicio"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="input-field w-full"
          />
        </div>
        <div>
          <label htmlFor="rel-vendas-fim" className="field-label">Data final</label>
          <input
            id="rel-vendas-fim"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="input-field w-full"
          />
        </div>
        <div>
          <label htmlFor="rel-vendas-representante" className="field-label">Representante</label>
          <select
            id="rel-vendas-representante"
            value={vendedorId}
            onChange={(e) => setVendedorId(e.target.value)}
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
          <label htmlFor="rel-vendas-busca" className="field-label">Busca</label>
          <input
            id="rel-vendas-busca"
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onBuscar();
            }}
            placeholder="Cliente, ordem (#278) ou observação"
            className="input-field w-full"
          />
        </div>
        {maisFiltrosAbertos ? (
          <>
            <div>
              <label htmlFor="rel-vendas-cliente" className="field-label">Cliente</label>
              <select
                id="rel-vendas-cliente"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Todos</option>
                {clientes.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nomeFantasia || c.razaoSocial}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rel-vendas-produto" className="field-label">Produto</label>
              <select
                id="rel-vendas-produto"
                value={produtoId}
                onChange={(e) => setProdutoId(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Todos</option>
                {produtos.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rel-vendas-produto-busca" className="field-label">
                Produto contém
              </label>
              <input
                id="rel-vendas-produto-busca"
                type="text"
                value={produtoBusca}
                onChange={(e) => setProdutoBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onBuscar();
                }}
                placeholder="Ex.: dolomita, cal hidratada"
                className="input-field w-full"
              />
            </div>
            <div>
              <label htmlFor="rel-vendas-motorista" className="field-label">Motorista</label>
              <select
                id="rel-vendas-motorista"
                value={motoristaId}
                onChange={(e) => setMotoristaId(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Todos</option>
                {motoristas.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.nome}
                    {m.placa ? ` (${m.placa})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}
      </div>

      <div className="pt-3 border-t border-gray-100 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" onClick={onBuscar} className="btn-primary h-10">
            <MagnifyingGlassIcon className="w-4 h-4" /> Gerar
          </button>
          <button type="button" onClick={onLimpar} className="btn-secondary h-10">
            Limpar
          </button>
          <button
            type="button"
            onClick={() => setMaisFiltrosAbertos((open) => !open)}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 h-10"
          >
            {maisFiltrosAbertos ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
            {maisFiltrosAbertos ? "Ocultar filtros" : "Mais filtros"}
          </button>
        </div>
        {data ? (
          <div className="flex items-center justify-center gap-2 flex-nowrap flex-1">
            <button
              type="button"
              onClick={onExportExcel}
              disabled={exportando}
              className="btn-secondary h-10 shrink-0"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              {exportando ? "Exportando..." : "Excel"}
            </button>
            <button
              type="button"
              onClick={onExportPdfCompleto}
              disabled={exportando}
              className="btn-secondary h-10 shrink-0"
              title="Relatório completo para enviar ao cliente (Salvar como PDF na impressão)"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              {exportando ? "Exportando..." : "PDF completo"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
