import type { Metadata } from 'next';
import { contactEmail } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy · Cync' };

export default function Privacy() {
  return (
    <article className="legal">
      <h1>Privacy</h1>
      <p className="hint">Last updated November 8, 2026</p>

      <h2>What Cync does not collect</h2>
      <p>Cync has no accounts and asks for no name or email. It sets no cookies and runs no analytics of its own.</p>

      <h2>Requests to our server</h2>
      <p>
        To build a link preview or a transaction, the server receives the details in the link and, when you pay, your
        wallet address. Your IP address is kept in memory for rate limiting only and is not written to request logs.
      </p>

      <h2>Your browser</h2>
      <p>Your browser keeps your wallet connection in local storage so you stay connected. You can clear it at any time.</p>

      <h2>Public blockchain</h2>
      <p>Transactions are public and permanent on the blockchain, including wallet addresses and amounts.</p>

      <h2>Other services</h2>
      <p>
        These services receive your IP address and the data needed to do their job, under their own privacy policies:
      </p>
      <ul>
        <li>WalletConnect (Reown), when you connect a wallet through it. It also collects usage statistics.</li>
        <li>The Sonic network RPC, which your browser contacts to read balances and fees.</li>
        <li>The image host a link creator chose, when a link uses a custom image.</li>
        <li>The block explorer, if you open a transaction there.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </p>
    </article>
  );
}
