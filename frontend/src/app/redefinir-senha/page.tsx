'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import api, { ApiError } from '@/lib/api';
import { reportApiError } from '@/lib/report-api-error';
import BrandLogo from '@/components/BrandLogo';

function RedefinirSenhaForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = useMemo(() => String(search.get('token') || '').trim(), [search]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!token) {
      setLocalError('Link inválido ou incompleto.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setLocalError('A confirmação não confere com a senha.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => router.replace('/login'), 1800);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        reportApiError(err, { title: 'Muitas tentativas' });
      } else {
        reportApiError(err, { title: 'Não foi possível redefinir' });
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
          Redefinir senha
        </h1>

        {done ? (
          <div
            className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm px-4 py-3"
            data-testid="reset-password-success"
          >
            Senha alterada. Redirecionando para o login…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {localError ? (
              <p className="text-sm text-red-600" role="alert">
                {localError}
              </p>
            ) : null}
            <div>
              <label htmlFor="reset-password" className="block text-sm font-medium text-gray-700 mb-1">
                Nova senha
              </label>
              <input
                id="reset-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="reset-password-input"
              />
            </div>
            <div>
              <label htmlFor="reset-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar senha
              </label>
              <input
                id="reset-confirm"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="input-field"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                data-testid="reset-password-confirm"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !token}
              className="btn-primary w-full"
              data-testid="reset-password-submit"
            >
              {loading ? 'Salvando…' : 'Alterar senha'}
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

export default function RedefinirSenhaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
          A carregar…
        </div>
      }
    >
      <RedefinirSenhaForm />
    </Suspense>
  );
}
