"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, TrashIcon } from "@heroicons/react/24/outline";
import {
  formatMoney,
  formatDate,
  formatQuantidade,
  type Venda,
} from "@/lib/utils";
import api from "@/lib/api";

export default function VendaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [venda, setVenda] = useState<Venda | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    api
      .get<Venda>(`/vendas/${id}`)
      .then(setVenda)
      .finally(() => setLoading(false));
  }, [id]);

  const handleCancelar = async () => {
    if (
      !confirm(
        "Tem certeza que deseja cancelar esta venda? O estoque será estornado.",
      )
    )
      return;
    setCancelando(true);
    try {
      await api.delete(`/vendas/${id}`);
      router.push("/vendas");
    } catch (e: any) {
      alert(e.message);
      setCancelando(false);
    }
  };

  if (loading)
    return <div className="p-8 text-center text-gray-400">Carregando...</div>;
  if (!venda)
    return (
      <div className="p-8 text-center text-gray-400">Venda não encontrada</div>
    );

  const subtotal = venda.itens.reduce(
    (acc, i) => acc + parseFloat(String(i.subtotal)),
    0,
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/vendas" className="btn-secondary py-1.5 px-2.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Venda #{venda.id}
          </h1>
          <p className="text-gray-500 text-sm">{formatDate(venda.dataVenda)}</p>
        </div>
        <button
          onClick={handleCancelar}
          disabled={cancelando}
          className="btn-danger"
        >
          <TrashIcon className="w-4 h-4" />
          {cancelando ? "Cancelando..." : "Cancelar Venda"}
        </button>
      </div>

      {/* Info da venda */}
      <div className="card p-5 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase">
              Cliente
            </p>
            <Link
              href={`/clientes/${venda.clienteId}`}
              className="font-medium text-blue-600 hover:underline mt-1 block"
            >
              {venda.cliente.nomeFantasia || venda.cliente.razaoSocial}
            </Link>
            {venda.cliente.cidade && (
              <p className="text-xs text-gray-400">
                {venda.cliente.cidade}-{venda.cliente.estado}
              </p>
            )}
          </div>
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase">
              Vendedor
            </p>
            <p className="font-medium mt-1">{venda.vendedor.nome}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase">
              Motorista
            </p>
            <p className="font-medium mt-1">{venda.motorista?.nome || "-"}</p>
            {venda.motorista?.placa && (
              <p className="text-xs text-gray-400">{venda.motorista.placa}</p>
            )}
          </div>
          {venda.observacoes && (
            <div className="col-span-full">
              <p className="text-gray-500 text-xs font-semibold uppercase">
                Observações
              </p>
              <p className="font-medium mt-1">{venda.observacoes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Itens */}
      <div className="card overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Produtos</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="table-header">Produto</th>
              <th className="table-header text-right">Quantidade</th>
              <th className="table-header text-right">Preço Unit.</th>
              <th className="table-header text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {venda.itens.map((item) => (
              <tr key={item.id} className="table-row">
                <td className="table-cell font-medium">{item.produto.nome}</td>
                <td className="table-cell text-right">
                  {formatQuantidade(item.quantidade, item.produto.unidade)}
                </td>
                <td className="table-cell text-right">
                  {formatMoney(item.precoUnitario)}
                </td>
                <td className="table-cell text-right font-medium">
                  {formatMoney(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totais */}
      <div className="card p-5">
        <div className="flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex justify-between font-bold text-gray-900 border-b pb-2 mb-1">
              <span>Total Produtos:</span>
              <span className="text-green-700 text-lg">
                {formatMoney(venda.valorTotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Frete (cobrado à parte):</span>
              <span className="font-medium">{formatMoney(venda.frete)}</span>
            </div>
            {venda.freteRecibo && (
              <div className="text-xs text-blue-600 text-right">
                Recibo de frete
                {venda.freteReciboNum ? `: ${venda.freteReciboNum}` : ""}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
