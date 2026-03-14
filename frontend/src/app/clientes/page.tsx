"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { formatMoney, formatCNPJ, type Cliente } from "@/lib/utils";
import api from "@/lib/api";

const PAGE_SIZE = 20;

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState("");
  const [buscaInput, setBuscaInput] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback((b: string, p: number) => {
    const params = new URLSearchParams({
      ativo: "true",
      take: String(PAGE_SIZE),
      skip: String(p * PAGE_SIZE),
    });
    if (b) params.set("busca", b);
    setLoading(true);
    api
      .get<{ clientes: Cliente[]; total: number }>(`/clientes?${params}`)
      .then((data) => {
        setClientes(data.clientes);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregar(busca, page);
  }, [busca, page]);

  const handleBuscar = () => {
    setPage(0);
    setBusca(buscaInput);
  };
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} clientes cadastrados
          </p>
        </div>
        <Link href="/clientes/novo" className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          Novo Cliente
        </Link>
      </div>

      {/* Busca */}
      <div className="card mb-4">
        <div className="p-4 flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, CNPJ ou cidade..."
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
              className="input-field pl-9"
            />
          </div>
          <button onClick={handleBuscar} className="btn-primary">
            Buscar
          </button>
          {busca && (
            <button
              onClick={() => {
                setBuscaInput("");
                setBusca("");
                setPage(0);
              }}
              className="btn-secondary"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : clientes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Razão Social / Fantasia</th>
                <th className="table-header">CNPJ</th>
                <th className="table-header">Cidade / UF</th>
                <th className="table-header">Telefone</th>
                <th className="table-header">Frete Padrão</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="table-cell">
                    <p className="font-medium">{c.razaoSocial}</p>
                    {c.nomeFantasia && c.nomeFantasia !== c.razaoSocial && (
                      <p className="text-xs text-gray-400">{c.nomeFantasia}</p>
                    )}
                  </td>
                  <td className="table-cell font-mono text-sm">
                    {formatCNPJ(c.cnpj)}
                  </td>
                  <td className="table-cell">
                    {c.cidade
                      ? `${c.cidade}${c.estado ? " - " + c.estado : ""}`
                      : "-"}
                  </td>
                  <td className="table-cell">{c.telefone || "-"}</td>
                  <td className="table-cell">{formatMoney(c.fretePadrao)}</td>
                  <td className="table-cell">
                    <Link
                      href={`/clientes/${c.id}`}
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de{" "}
            {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 flex items-center px-2">
              Pág. {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
              className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
