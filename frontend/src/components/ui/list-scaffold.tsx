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
    <div className="p-4 sm:p-6 lg:px-8 w-full max-w-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {supportingText ? <p className="text-gray-500 text-sm mt-1">{supportingText}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
      {filters}
      {content}
      {children}
      {footer}
    </div>
  );
}
