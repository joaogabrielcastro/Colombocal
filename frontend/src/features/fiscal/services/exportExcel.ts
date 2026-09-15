import * as XLSX from "xlsx";

export function downloadFiscalXlsx(
  filename: string,
  rows: Array<Record<string, unknown>>,
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "NF-e");
  XLSX.writeFile(wb, filename);
}
