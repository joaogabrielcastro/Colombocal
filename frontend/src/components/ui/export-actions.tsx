"use client";

type ExportActionsProps = {
  onExportPdf?: () => void | Promise<void>;
  onExportExcel?: () => void | Promise<void>;
  busy?: boolean;
  className?: string;
};

export function ExportActions({
  onExportPdf,
  onExportExcel,
  busy = false,
  className = "",
}: ExportActionsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {onExportPdf ? (
        <button
          type="button"
          onClick={() => void onExportPdf()}
          className="btn-secondary"
          disabled={busy}
        >
          {busy ? "Exportando…" : "Exportar PDF"}
        </button>
      ) : null}
      {onExportExcel ? (
        <button
          type="button"
          onClick={() => void onExportExcel()}
          className="btn-secondary"
          disabled={busy}
        >
          {busy ? "Exportando…" : "Exportar Excel"}
        </button>
      ) : null}
    </div>
  );
}
