"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  pageSize?: number;
  zeroBased?: boolean;
  noun?: string;
};

export function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  pageSize,
  zeroBased = false,
  noun = "registro",
}: PaginationProps) {
  const current = zeroBased ? page + 1 : page;
  const safeTotalPages = Math.max(1, totalPages);
  const start = total != null && pageSize ? (current - 1) * pageSize + 1 : null;
  const end = total != null && pageSize ? Math.min(current * pageSize, total) : null;

  if (totalPages <= 1 && total == null) return null;

  return (
    <nav
      className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Paginação"
    >
      <p aria-live="polite">
        {total != null ? (
          total > 0 ? (
            <><span className="font-semibold text-slate-800">{start}–{end}</span> de {total} {noun}{total === 1 ? "" : "s"}</>
          ) : `Nenhum ${noun}`
        ) : `Página ${current} de ${safeTotalPages}`}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            type="button"
            className="btn-secondary px-3"
            disabled={current <= 1}
            onClick={() => onPageChange(zeroBased ? page - 1 : page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Anterior</span>
          </button>
          <span className="min-w-24 text-center font-medium text-slate-700">
            {current} de {safeTotalPages}
          </span>
          <button
            type="button"
            className="btn-secondary px-3"
            disabled={current >= safeTotalPages}
            onClick={() => onPageChange(zeroBased ? page + 1 : page + 1)}
            aria-label="Próxima página"
          >
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </nav>
  );
}
