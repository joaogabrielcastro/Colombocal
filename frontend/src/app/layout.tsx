import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientShell from '@/components/ClientShell';
import AppProviders from '@/components/AppProviders';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Colombocal - Gestão Comercial',
  description: 'Sistema de gestão comercial para distribuidora de cal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AppProviders>
          <ClientShell>{children}</ClientShell>
        </AppProviders>
      </body>
    </html>
  );
}
