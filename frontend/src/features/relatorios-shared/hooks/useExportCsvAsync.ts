"use client";

import { useState } from "react";
import api from "@/lib/api";
import { waitForAsyncExportDownloadUrl } from "@/lib/async-export";

type Options = {
  startPath: string;
  maxAttempts?: number;
  pollIntervalMs?: number;
  fallback?: () => void;
};

export function useExportCsvAsync(options: Options) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");

  const exportCsv = async (payload: unknown) => {
    try {
      setError("");
      setIsExporting(true);
      const downloadUrl = await waitForAsyncExportDownloadUrl(
        api,
        options.startPath,
        payload,
        {
          maxAttempts: options.maxAttempts ?? 60,
          pollIntervalMs: options.pollIntervalMs ?? 1000,
        },
      );
      window.open(downloadUrl, "_blank");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Erro ao exportar CSV assíncrono",
      );
      if (options.fallback) options.fallback();
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExporting,
    error,
    setError,
    exportCsv,
  };
}
