'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { setAuthToken } from '@/lib/auth-token';
import { reportApiError } from '@/lib/report-api-error';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{
        token: string;
        user: { email: string; name: string | null };
        tenant: { name: string };
      }>('/auth/login', { email: email.trim().toLowerCase(), password });
      setAuthToken(res.token);
      router.replace('/');
      router.refresh();
    } catch (err) {
      reportApiError(err, { title: 'Falha no login' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md card p-8 shadow-lg">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 bg-blue-600 rounded-xl items-center justify-center text-white font-bold text-lg mb-3">
            C
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Colombocal</h1>
          <p className="text-sm text-gray-500 mt-1">Entre com seu e-mail e senha</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              autoComplete="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              autoComplete="current-password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="text-center mt-4">
          <Link href="/cadastro" className="text-sm font-medium text-blue-600 hover:underline">
            Criar conta para usar o sistema
          </Link>
        </p>
      </div>
    </div>
  );
}
