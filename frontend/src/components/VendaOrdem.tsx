"use client";

import Link from "next/link";
import { vendaNumeroPublico } from "@/lib/utils";

export type VendaOrdemRef = {
  id: number;
  numeroVenda?: number | null;
};

const SIZE_CLASS = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-2xl",
} as const;

type VendaOrdemProps = {
  venda: VendaOrdemRef;
  link?: boolean;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  /** Texto antes do # (ex.: "Venda") */
  prefix?: string;
};

export function vendaOrdemTexto(venda: VendaOrdemRef): string {
  return `#${vendaNumeroPublico(venda)}`;
}

export function VendaOrdem({
  venda,
  link = true,
  size = "md",
  className = "",
  prefix,
}: VendaOrdemProps) {
  const styles = [
    "inline-flex items-center gap-1 font-mono font-bold text-blue-700",
    SIZE_CLASS[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const numero = (
    <span className="tracking-tight">#{vendaNumeroPublico(venda)}</span>
  );

  const content = (
    <>
      {prefix ? (
        <span className="font-sans font-semibold text-gray-600">{prefix}</span>
      ) : null}
      {numero}
    </>
  );

  if (link) {
    return (
      <Link
        href={`/vendas/${venda.id}`}
        className={`${styles} hover:text-blue-900 hover:underline`}
        title={`Abrir venda ${vendaOrdemTexto(venda)}`}
      >
        {content}
      </Link>
    );
  }

  return <span className={styles}>{content}</span>;
}

/** Célula padrão para listagens tabulares. */
export function VendaOrdemCell({
  venda,
  size = "md",
  className = "",
}: {
  venda: VendaOrdemRef;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  return (
    <td className={`table-cell bg-slate-50/90 align-middle whitespace-nowrap ${className}`.trim()}>
      <VendaOrdem venda={venda} size={size} />
    </td>
  );
}
