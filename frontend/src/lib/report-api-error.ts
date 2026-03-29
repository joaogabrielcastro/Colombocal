'use client';

import { toast } from 'sonner';
import { ApiError } from './api';

export type ReportApiErrorOptions = {
  /** Texto curto no topo do toast */
  title?: string;
  /** Inclui botão "Tentar novamente" */
  onRetry?: () => void | Promise<void>;
};

/**
 * Exibe toast com status HTTP, mensagem do servidor e ação de retry opcional.
 */
export function reportApiError(error: unknown, opts?: ReportApiErrorOptions) {
  const title = opts?.title ?? 'Não foi possível concluir a operação';

  let description: string;
  if (error instanceof ApiError) {
    description = `[${error.status}] ${error.message}`;
  } else if (error instanceof Error) {
    description = error.message;
  } else {
    description = 'Erro desconhecido';
  }

  toast.error(title, {
    description,
    duration: 6500,
    action:
      opts?.onRetry != null
        ? {
            label: 'Tentar novamente',
            onClick: () => {
              void Promise.resolve(opts.onRetry?.()).catch(() => {
                /* evita unhandled; novo toast virá do caller */
              });
            },
          }
        : undefined,
  });
}
