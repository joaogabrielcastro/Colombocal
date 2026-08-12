/** CSV no padrão do Excel em português (separador `;`, decimal `,`). */

function csvCell(value: string | number): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(2).replace(".", ",");
  }
  const s = String(value ?? "").replace(/"/g, '""');
  if (/[;\n\r"]/.test(s)) return `"${s}"`;
  return s;
}

export function downloadCsvPtBr(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
) {
  const lines = [
    headers.join(";"),
    ...rows.map((row) => row.map(csvCell).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
