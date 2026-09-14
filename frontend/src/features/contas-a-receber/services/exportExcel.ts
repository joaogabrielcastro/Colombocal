import * as XLSX from "xlsx";

export function downloadXlsx(
  filename: string,
  sheetName: string,
  rows: Array<Record<string, unknown>>,
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

export function nomeArquivoExcel(prefixo: string) {
  return `${prefixo}_${new Date().toISOString().slice(0, 10)}.xlsx`;
}
