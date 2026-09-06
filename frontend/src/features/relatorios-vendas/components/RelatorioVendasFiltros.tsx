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
    onBuscar,
    onLimpar,
    onExportExcel,
    onExportPdfCompleto,
    exportando = false,
  } = props;

  const [maisFiltrosAbertos, setMaisFiltrosAbertos] = useState(
    () => Boolean(clienteId || produtoId || motoristaId),
  );

  return (
    <div className="card p-4 sm:p-5 mb-6 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Data Inicial</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="input-field w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Data Final</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="input-field w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Representante</label>
          <select
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
          <label className="block text-xs font-medium text-gray-500 mb-1">Busca</label>
          <input
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
              <select
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Produto</label>
              <select
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Motorista</label>
              <select
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
