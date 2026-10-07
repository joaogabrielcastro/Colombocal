"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  secondaryText?: string;
  onSecondary?: () => void;
  children?: ReactNode;
  /** Desabilita o botão de confirmar (ex.: formulário incompleto). */
  confirmDisabled?: boolean;
  /** Para diálogos informativos que precisam apenas da ação principal. */
  hideCancel?: boolean;
};

function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  return Array.from(nodes).filter(
    (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
  secondaryText,
  onSecondary,
  children,
  confirmDisabled = false,
  hideCancel = false,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const panel = panelRef.current;
    const focusables = panel ? getFocusable(panel) : [];
    const initial =
      focusables.find((el) => el.tagName === "TEXTAREA" || el.tagName === "INPUT") ||
      focusables.find((el) => el.classList.contains("btn-primary") || el.classList.contains("btn-danger")) ||
      focusables[0];
    initial?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (busyRef.current) return;
        e.preventDefault();
        onCancelRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = getFocusable(panel);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const onPanelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && !busy) {
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onKeyDown={onPanelKeyDown}
      >
        <h3 id={titleId} className="text-lg font-semibold text-gray-900">
          {title}
        </h3>
        {description ? (
          <p
            id={descId}
            className="mt-2 max-h-60 overflow-y-auto text-sm text-gray-600 whitespace-pre-line"
          >
            {description}
          </p>
        ) : null}
        {children}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {!hideCancel ? (
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
              {cancelText}
            </button>
          ) : null}
          {secondaryText && onSecondary ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={onSecondary}
              disabled={busy}
            >
              {secondaryText}
            </button>
          ) : null}
          <button
            type="button"
            className={tone === "danger" ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
