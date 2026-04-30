"use client";

import type { ReactNode } from "react";

type FilterBarProps = {
  children: ReactNode;
  className?: string;
};

export function FilterBar({ children, className = "" }: FilterBarProps) {
  return <div className={`card mb-4 ${className}`.trim()}>{children}</div>;
}
