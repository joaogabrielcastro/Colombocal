import type { ComponentType, ReactNode } from "react";
import { InboxIcon } from "@heroicons/react/24/outline";

export function EmptyState({
  title,
  description,
  action,
  compact = false,
  icon: Icon = InboxIcon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-6 text-center ${compact ? "py-6" : "py-12"}`}
      role="status"
    >
      {!compact ? (
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-gray-200">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      ) : null}
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
