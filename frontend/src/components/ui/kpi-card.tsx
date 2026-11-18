import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const TONE_ICON: Record<Tone, string> = {
  neutral: "bg-gray-100 text-gray-500",
  brand: "bg-blue-50 text-blue-800",
  success: "bg-green-50 text-green-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-600",
};

const TONE_VALUE: Record<Tone, string> = {
  neutral: "text-gray-950",
  brand: "text-gray-950",
  success: "text-gray-950",
  warning: "text-gray-950",
  danger: "text-red-700",
};

type KpiCardProps = {
  label: string;
  value: ReactNode;
  /** Linha de contexto abaixo do valor. */
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: Tone;
  href?: string;
  /** Texto do link para leitores de tela (o card inteiro é clicável). */
  linkLabel?: string;
  loading?: boolean;
};

/** Indicador numérico compacto, opcionalmente clicável para a tela de detalhe. */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
  linkLabel,
  loading = false,
}: KpiCardProps) {
  const body = (
    <div
      className={`card flex h-full flex-col gap-3 p-3.5 sm:p-5 ${
        href ? "transition-[border-color,box-shadow] hover:border-gray-300 hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-gray-500">{label}</p>
        {Icon ? (
          <span className={`flex h-7 w-7 items-center justify-center rounded-md ${TONE_ICON[tone]}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="h-7 w-full max-w-32 animate-pulse rounded-md bg-gray-200/70" aria-hidden="true" />
      ) : (
        <p className={`truncate text-lg font-semibold tabular-nums tracking-tight sm:text-2xl ${TONE_VALUE[tone]}`}>{value}</p>
      )}
      {hint ? <p className="-mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} aria-label={linkLabel} className="block h-full rounded-xl">
      {body}
    </Link>
  );
}
