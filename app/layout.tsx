import type { Metadata } from 'next';
import Link from 'next/link';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cync — Onchain actions, one link away',
  description: 'Turn an onchain action into a link anyone can open, verify, and complete. Demo on Sonic testnet.',
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <header className="nav">
            <Link href="/" className="brand">
              <img src="/logo.png" alt="" />
              <span>CYNC</span>
              <em>by Avenor</em>
            </Link>
            <span className="net">Sonic Testnet · Demo</span>
          </header>
          <main className="main">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
