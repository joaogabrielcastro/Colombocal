"use client";

type ExportActionsProps = {
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  className?: string;
};

export function ExportActions({
  onExportPdf,
  onExportExcel,
  className = "",
}: ExportActionsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {onExportPdf ? (
        <button type="button" onClick={onExportPdf} className="btn-secondary">
          Exportar PDF
        </button>
      ) : null}
      {onExportExcel ? (
        <button type="button" onClick={onExportExcel} className="btn-secondary">
          Exportar Excel
        </button>
      ) : null}
    </div>
  );
}
