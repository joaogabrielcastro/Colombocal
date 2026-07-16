import Link from "next/link";
import { ArrowLeftIcon, PlusIcon } from "@heroicons/react/24/outline";
import { formatDocumentoCliente, type Cliente } from "@/lib/utils";

export function ClienteHeader({ cliente, clienteId }: { cliente: Cliente; clienteId: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <Link href="/clientes" className="btn-secondary py-1.5 px-2.5 mt-1"><ArrowLeftIcon className="w-4 h-4" /></Link>
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-gray-900">{cliente.nomeFantasia || cliente.razaoSocial}</h1>
        <p className="text-gray-500 text-sm">{cliente.razaoSocial} • {formatDocumentoCliente(cliente)}</p>
        {cliente.cidade ? <p className="text-gray-400 text-xs mt-0.5">{cliente.cidade}{cliente.estado ? ` - ${cliente.estado}` : ""}</p> : null}
      </div>
      <Link href={`/vendas/nova?clienteId=${clienteId}`} className="btn-primary"><PlusIcon className="w-4 h-4" /> Nova Venda</Link>
    </div>
  );
}
