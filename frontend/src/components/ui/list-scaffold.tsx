"use client";

import type { ReactNode } from "react";
import { PageHeader, type Crumb } from "@/components/ui/page-header";

type ListScaffoldProps = {
  title: string;
  subtitle?: ReactNode;
  /** Alias legado mantido para páginas ainda não migradas. */
  description?: ReactNode;
  breadcrumbs?: Crumb[];
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
  breadcrumbs,
  actions,
  filters,
  content,
  children,
  footer,
}: ListScaffoldProps) {
  return (
    <div className="page-container">
      <PageHeader
        title={title}
        subtitle={subtitle ?? description}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />
      {filters}
      {content}
      {children}
      {footer}
    </div>
  );
}
