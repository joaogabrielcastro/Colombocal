import type { ReactNode } from "react";
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  LightBulbIcon,
} from "@heroicons/react/24/outline";

type Variant = "info" | "tip" | "warning";

const VARIANTS: Record<
  Variant,
  { box: string; title: string; Icon: typeof InformationCircleIcon }
> = {
  info: {
    box: "border-blue-200 bg-blue-50 text-blue-950",
    title: "text-blue-900",
    Icon: InformationCircleIcon,
  },
  tip: {
    box: "border-amber-200 bg-amber-50 text-amber-950",
    title: "text-amber-900",
    Icon: LightBulbIcon,
  },
  warning: {
    box: "border-orange-200 bg-orange-50 text-orange-950",
    title: "text-orange-900",
    Icon: ExclamationTriangleIcon,
  },
};

export function HelpCallout({
  title,
  children,
  variant = "tip",
  className = "",
  action,
}: {
  title?: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
  action?: ReactNode;
}) {
  const { box, title: titleClass, Icon } = VARIANTS[variant];

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${box} ${className}`}
      role="note"
    >
      <div className="flex gap-3">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${titleClass}`} aria-hidden />
        <div className="min-w-0 flex-1">
          {title ? (
            <p className={`font-medium ${titleClass}`}>{title}</p>
          ) : null}
          <div className={title ? "mt-1.5 opacity-95" : ""}>{children}</div>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
