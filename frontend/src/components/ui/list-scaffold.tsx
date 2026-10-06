"use client";

import type { ReactNode } from "react";

type ListScaffoldProps = {
  title: string;
  subtitle?: ReactNode;
  /** Alias legado mantido para páginas ainda não migradas. */
  description?: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  content?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
};

export function ListScaffold({
  title,
  subtitle,
  description,
  actions,
  filters,
  content,
  children,
  footer,
}: ListScaffoldProps) {
  const supportingText = subtitle ?? description;
  return (
    <div className="page-container">
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[1.75rem]">{title}</h1>
          {supportingText ? <p className="mt-1.5 max-w-3xl text-sm leading-5 text-slate-600">{supportingText}</p> : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">{actions}</div> : null}
      </div>
      {filters}
      {content}
      {children}
      {footer}
    </div>
  );
}
