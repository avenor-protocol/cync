import type { Metadata } from 'next';
import { contactEmail } from '@/lib/site';

export const metadata: Metadata = { title: 'Terms · Cync' };

export default function Terms() {
  return (
    <article className="legal">
      <h1>Terms of Use</h1>
      <p className="hint">Last updated November 8, 2026</p>

      <h2>A demo on testnet</h2>
      <p>
        Cync is a demo run by Avenor on Sonic testnet. Test tokens have no value and cannot be exchanged for money. The
        service can change, break, or stop at any time, and test data can be lost.
      </p>

      <h2>Your wallet and your transactions</h2>
      <p>
        Cync never holds your private keys and cannot sign for you. Every transaction is created for your review and
        signed in your own wallet. You are responsible for checking the recipient, token, and amount before you sign.
        Blockchain transactions cannot be reversed.
      </p>

      <h2>Links made by other people</h2>
      <p>
        Anyone can create a Cync link. Titles, descriptions, and images come from the link creator and are not reviewed
        by Avenor. A link marked Unverified has not been checked, and a creator signature only shows which wallet signed
        the link, not that its owner can be trusted. Only pay links from sources you trust.
      </p>

      <h2>Fees</h2>
      <p>Payments through the Cync router may include a platform fee. The fee is shown on the action card before you sign.</p>

      <h2>Acceptable use</h2>
      <p>
        Do not use Cync for scams, phishing, impersonation, or anything unlawful, and do not try to disrupt the service.
        You are responsible for following the laws that apply to you.
      </p>

      <h2>No warranty</h2>
      <p>
        Cync is provided as is, without warranties of any kind. To the extent the law allows, Avenor is not liable for
        losses that result from using the service, including mistaken transactions, smart contract faults, and network
        or wallet failures.
      </p>

      <h2>Changes and contact</h2>
      <p>
        These terms may change, and the date above shows the latest version. Questions:{' '}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </p>
    </article>
  );
}
