import Link from 'next/link';

/** Texto único explicando frete na venda vs tela Fretes (evita duplicidade confusa para o usuário). */
export function FreteOrientacaoPainel({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  const box =
    variant === 'compact'
      ? 'rounded-lg border border-amber-100 bg-amber-50/90 px-3 py-2 text-xs text-amber-950'
      : 'rounded-xl border border-amber-100 bg-amber-50/90 px-4 py-3 text-sm text-amber-950';

  return (
    <div className={box}>
      <p className="font-medium text-amber-900">Frete — quando usar cada lugar</p>
      <ul className="mt-2 list-disc list-inside space-y-1 text-amber-900/90">
        <li>
          <strong>Venda (nova ou detalhe):</strong> defina o valor do frete e dados do recibo no fluxo normal da
          venda. É o caminho principal no dia a dia.
        </li>
        <li>
          <strong>Tela Fretes:</strong> visão de todos os movimentos, filtros por recibo, ajustes retroativos e
          conferência. Útil para financeiro e pós-venda.
        </li>
      </ul>
      <p className="mt-2 text-amber-800/85">
        O sistema mantém o valor alinhado entre venda e movimento de frete; use um único fluxo por operação para
        evitar divergência.
      </p>
      {variant === 'default' && (
        <Link href="/fretes" className="mt-2 inline-block text-sm font-medium text-amber-950 underline">
          Abrir tela Fretes
        </Link>
      )}
    </div>
  );
}
