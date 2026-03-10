'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatMoney, formatCNPJ, type Cliente } from '@/lib/utils';
import api from '@/lib/api';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Cliente[]>('/clientes?ativo=true')
      .then(setClientes)
      .finally(() => setLoading(false));
  }, []);

  const filtrados = clientes.filter(c =>
    !busca ||
    c.razaoSocial.toLowerCase().includes(busca.toLowerCase()) ||
    (c.nomeFantasia || '').toLowerCase().includes(busca.toLowerCase()) ||
    c.cnpj.includes(busca.replace(/\D/g, '')) ||
    (c.cidade || '').toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">{clientes.length} clientes cadastrados</p>
        </div>
        <Link href="/clientes/novo" className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          Novo Cliente
        </Link>
      </div>

      {/* Busca */}
      <div className="card mb-4">
        <div className="p-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, CNPJ ou cidade..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="input-field pl-9"
            />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
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
              {filtrados.map(c => (
                <tr key={c.id} className="table-row">
                  <td className="table-cell">
                    <p className="font-medium">{c.razaoSocial}</p>
                    {c.nomeFantasia && c.nomeFantasia !== c.razaoSocial && (
                      <p className="text-xs text-gray-400">{c.nomeFantasia}</p>
                    )}
                  </td>
                  <td className="table-cell font-mono text-sm">{formatCNPJ(c.cnpj)}</td>
                  <td className="table-cell">
                    {c.cidade ? `${c.cidade}${c.estado ? ' - ' + c.estado : ''}` : '-'}
                  </td>
                  <td className="table-cell">{c.telefone || '-'}</td>
                  <td className="table-cell">{formatMoney(c.fretePadrao)}</td>
                  <td className="table-cell">
                    <Link href={`/clientes/${c.id}`} className="text-blue-600 hover:underline text-sm font-medium">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
