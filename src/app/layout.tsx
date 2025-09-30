import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Navigation } from '@/src/components/ui/navigation';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FXFusion - Professional FX Exchange Platform',
  description: 'Create and manage diversified currency baskets with real-time performance tracking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 min-h-screen`}>
        <Navigation />
        <main>{children}</main>
      </body>
    </html>
  );
}