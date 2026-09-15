'use client';

import { useState } from 'react';
import Link from 'next/link';
import api, { ApiError } from '@/lib/api';
import { reportApiError } from '@/lib/report-api-error';
import BrandLogo from '@/components/BrandLogo';

const SUCCESS_MSG =
  'Se os dados forem válidos, enviaremos instruções para o e-mail informado.';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post<{ ok: boolean; message?: string }>('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        reportApiError(err, { title: 'Muitas tentativas' });
      } else {
        reportApiError(err, { title: 'Não foi possível enviar' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <div className="flex justify-center mb-6">
          <BrandLogo variant="full" className="scale-90" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 text-center mb-2">
          Esqueci a senha
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Informe o e-mail da sua conta. Se existir, enviaremos um link para
          redefinir a senha.
        </p>

        {done ? (
          <div
            className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm px-4 py-3"
            data-testid="forgot-password-success"
          >
            {SUCCESS_MSG}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="forgot-password-email"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              data-testid="forgot-password-submit"
            >
              {loading ? 'Enviando…' : 'Enviar instruções'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="text-blue-600 hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
