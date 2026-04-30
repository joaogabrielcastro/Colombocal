type ExportJobStatusResponse = {
  status: "pending" | "running" | "completed" | "failed";
  downloadUrl?: string | null;
  error?: string | null;
};

type ExportApiClient = {
  post: <T>(path: string, body: unknown) => Promise<T>;
  get: <T>(path: string) => Promise<T>;
};

type WaitExportOptions = {
  maxAttempts?: number;
  pollIntervalMs?: number;
};

export async function waitForAsyncExportDownloadUrl(
  api: ExportApiClient,
  startPath: string,
  payload: unknown,
  options: WaitExportOptions = {},
): Promise<string> {
  const maxAttempts = options.maxAttempts ?? 60;
  const pollIntervalMs = options.pollIntervalMs ?? 1000;

  const start = await api.post<{ jobId: string; status: string }>(startPath, payload);
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    const job = await api.get<ExportJobStatusResponse>(`/relatorios/exports/${start.jobId}`);
    if (job.status === "completed" && job.downloadUrl) {
      return job.downloadUrl;
    }
    if (job.status === "failed") {
      throw new Error(job.error || "Falha ao gerar exportação assíncrona");
    }
  }
  throw new Error("Exportação demorou mais do que o esperado. Tente novamente.");
}
