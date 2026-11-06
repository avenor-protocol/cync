import type { Metadata } from 'next';
import Link from 'next/link';
import { testTokens } from '@/lib/tokens';
import { Providers } from './providers';
import './globals.css';

const title = 'Cync | Onchain actions, one link away';
const description = 'Turn an onchain action into a link anyone can open, verify, and complete. Demo on Sonic testnet.';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  // preview images need absolute URLs; without this Next uses localhost, or the deployment URL on Vercel
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title,
  description,
  icons: { icon: '/logo.png' },
  openGraph: { title, description, siteName: 'Cync', type: 'website', images: [{ url: '/api/og', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title, description, images: ['/api/og'] },
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
            <div className="nav-right">
              {testTokens && <Link href="/faucet" className="nav-link">Get test tokens</Link>}
              <span className="net"><span className="net-long">Sonic </span>Testnet<span className="net-long"> · Demo</span></span>
            </div>
          </header>
          <main className="main">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
