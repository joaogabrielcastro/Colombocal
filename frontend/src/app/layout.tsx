import type { Metadata, Viewport } from 'next';
import './globals.css';
import ClientShell from '@/components/ClientShell';
import AppProviders from '@/components/AppProviders';
import PwaRegister from '@/components/PwaRegister';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description: 'Sistema de gestão comercial para distribuidora de cal',
  applicationName: BRAND.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: BRAND.name,
  },
    icons: {
      icon: [{ url: "/brand/emblem.svg", type: "image/svg+xml" }],
      apple: [{ url: "/brand/emblem.svg", type: "image/svg+xml" }],
    },
};

export const viewport: Viewport = {
  themeColor: BRAND.themeColor,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="font-sans">
        <PwaRegister />
        <AppProviders>
          <ClientShell>{children}</ClientShell>
        </AppProviders>
      </body>
    </html>
  );
}
