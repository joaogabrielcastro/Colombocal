import api from "@/lib/api";

export async function downloadFiscalFile(path: string): Promise<void> {
  const { blob, filename } = await api.getBlob(path);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  anchor.target = "_blank";
  if (filename) anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
