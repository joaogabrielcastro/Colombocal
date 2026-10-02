"use client";

import type { FormEventHandler, ReactNode } from "react";

type FilterBarProps = {
  children: ReactNode;
  className?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

export function FilterBar({ children, className = "", onSubmit }: FilterBarProps) {
  if (onSubmit) {
    return <form className={`card mb-4 ${className}`.trim()} onSubmit={onSubmit}>{children}</form>;
  }
  return <div className={`card mb-4 ${className}`.trim()}>{children}</div>;
}
