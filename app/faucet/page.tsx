import { notFound } from 'next/navigation';
import { Faucet } from '@/components/Faucet';
import { testTokens } from '@/lib/tokens';

export const metadata = { title: 'Cync | Testnet tokens' };

export default function FaucetPage() {
  if (!testTokens) notFound();
  return (
    <div className="faucet-page">
      <h1>Testnet tokens</h1>
      <p className="hint">
        Get free test S for gas from the Sonic faucet, then test USSD and USDC here to try Cync links. They exist only on
        Sonic testnet and have no value.
      </p>
      <Faucet />
    </div>
  );
}
