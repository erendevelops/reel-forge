import type { ReactNode } from 'react';
import { JetBrains_Mono, Nunito, Silkscreen } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import { getSettings } from '@/lib/app/settings';
import './globals.css';

const px = Silkscreen({ weight: ['400', '700'], subsets: ['latin', 'latin-ext'], variable: '--font-px' });
const mono = JetBrains_Mono({ weight: ['400', '500'], subsets: ['latin', 'latin-ext'], variable: '--font-mono' });
const body = Nunito({ weight: ['400', '600', '700', '800'], subsets: ['latin', 'latin-ext'], variable: '--font-body' });

export const metadata = { title: 'Reelforge' };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { language } = await getSettings();
  return (
    <html lang={language} className={`${px.variable} ${mono.variable} ${body.variable}`}>
      <body>
        <AppShell lang={language}>{children}</AppShell>
      </body>
    </html>
  );
}
