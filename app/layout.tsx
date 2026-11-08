import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';
import Link from 'next/link';
import { isMainnet } from '@/lib/chain';
import { contactEmail, socialLinks } from '@/lib/site';
import { testTokens } from '@/lib/tokens';
import { Providers } from './providers';
import './globals.css';

// downloaded at build time and served from this site, so visitors never contact Google
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const sora = Sora({ subsets: ['latin'], variable: '--font-sora' });

const title = 'Cync | Onchain actions, one link away';
const description = `Turn an onchain action into a link anyone can open, verify, and complete. ${isMainnet ? 'Live on Sonic.' : 'Demo on Sonic testnet.'}`;
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
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
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
              {isMainnet ? (
                <span className="net">Sonic</span>
              ) : (
                <span className="net"><span className="net-long">Sonic </span>Testnet<span className="net-long"> · Demo</span></span>
              )}
            </div>
          </header>
          <main className="main">{children}</main>
          <footer className="footer">
            <span>{isMainnet ? 'Avenor · Live on Sonic.' : 'Avenor · Demo on Sonic testnet. Test tokens have no value.'}</span>
            <div className="footer-links">
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
              <a href={`mailto:${contactEmail}`}>Contact</a>
              {socialLinks.map(s => <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label}</a>)}
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
