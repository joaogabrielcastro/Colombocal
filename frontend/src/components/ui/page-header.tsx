import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@heroicons/react/20/solid";

export type Crumb = { label: string; href?: string };

type PageHeaderProps = {
  title: ReactNode;
  /** Texto de apoio curto (uma linha, de preferência). */
  subtitle?: ReactNode;
  /** Trilha de navegação acima do título (ex.: Vendas › #12). */
  breadcrumbs?: Crumb[];
  /** Ações primárias da página, alinhadas à direita. */
  actions?: ReactNode;
  /** Conteúdo extra abaixo do título (badges, metadados). */
  meta?: ReactNode;
  className?: string;
  /** testid preservado para E2E (`dashboard-title` etc.). */
  titleTestId?: string;
};

/**
 * Cabeçalho padrão de página: breadcrumb, título, apoio e ações.
 * Mantém o mesmo ritmo vertical em todas as telas.
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  meta,
  className = "",
  titleTestId,
}: PageHeaderProps) {
  return (
    <header
      className={`mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 ${className}`.trim()}
    >
      <div className="min-w-0 flex-[1_1_22rem]">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Trilha" className="mb-1.5">
            <ol className="flex flex-wrap items-center gap-1 text-xs font-medium text-gray-500">
              {breadcrumbs.map((c, i) => (
                <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 ? (
                    <ChevronRightIcon className="h-3.5 w-3.5 text-gray-300" aria-hidden="true" />
                  ) : null}
                  {c.href ? (
                    <Link href={c.href} className="hover:text-gray-900 hover:underline underline-offset-2">
                      {c.label}
                    </Link>
                  ) : (
                    <span className="text-gray-600">{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <h1
          className="text-[1.375rem] font-semibold leading-tight text-gray-950 sm:text-2xl"
          data-testid={titleTestId}
        >
          {title}
        </h1>
        {subtitle ? (
          <div className="mt-1 max-w-3xl text-sm leading-5 text-gray-500">{subtitle}</div>
        ) : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
