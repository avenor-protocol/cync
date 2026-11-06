'use client';

import { useState } from 'react';
import { erc20Abi, formatUnits, type Hex } from 'viem';
import { useBalance, usePublicClient, useReadContracts, useWriteContract } from 'wagmi';
import { chain } from '@/lib/chain';
import { testTokenAbi, tokens, type Token } from '@/lib/tokens';
import { useWallet, walletError } from '@/lib/useWallet';

const erc20s = tokens.filter(t => t.address);
const sonicFaucet = 'https://testnet.soniclabs.com/account';

const show = (value: bigint | undefined, decimals: number) =>
  value === undefined ? '—' : Number(formatUnits(value, decimals)).toLocaleString('en-US', { maximumFractionDigits: 4 });

// Mints 1,000 test USSD / USDC to the connected wallet. Gas is paid in testnet S from the Sonic faucet.
export function Faucet() {
  const { address, connect } = useWallet();
  const { mutateAsync: writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: chain.id });
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string; hash?: Hex }>();

  const native = useBalance({ address, chainId: chain.id, query: { enabled: !!address } });
  const balances = useReadContracts({
    contracts: erc20s.map(t => ({ address: t.address!, abi: erc20Abi, functionName: 'balanceOf', args: [address!], chainId: chain.id }) as const),
    query: { enabled: !!address },
  });

  async function drip(token: Token) {
    setBusy(token.symbol);
    setStatus(undefined);
    try {
      const account = await connect();
      const hash = await writeContractAsync({ address: token.address!, abi: testTokenAbi, functionName: 'drip', account, chainId: chain.id });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Transaction failed');
      setStatus({ ok: true, text: `Received 1,000 test ${token.symbol}`, hash });
      balances.refetch();
      native.refetch();
    } catch (e) {
      setStatus({ ok: false, text: walletError(e) });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="card faucet">
      <div className="faucet-row">
        <div>
          <b>{chain.nativeCurrency.symbol}</b>
          <span>For gas · {address ? show(native.data?.value, chain.nativeCurrency.decimals) : 'connect to see balance'}</span>
        </div>
        <a className="btn btn-ghost" href={sonicFaucet} target="_blank" rel="noreferrer">Sonic faucet</a>
      </div>
      {erc20s.map((t, i) => (
        <div className="faucet-row" key={t.symbol}>
          <div>
            <b>Test {t.symbol}</b>
            <span>{t.decimals} decimals · {address ? show(balances.data?.[i]?.result as bigint | undefined, t.decimals) : 'connect to see balance'}</span>
          </div>
          <button className="btn" onClick={() => drip(t)} disabled={!!busy}>
            {busy === t.symbol ? 'Confirm in wallet…' : `Get 1,000 ${t.symbol}`}
          </button>
        </div>
      ))}
      {status && (
        <div className={status.ok ? 'status ok' : 'status err'}>
          {status.text}
          {status.hash && (
            <> · <a href={`${chain.blockExplorers.default.url}/tx/${status.hash}`} target="_blank" rel="noreferrer">View on explorer</a></>
          )}
        </div>
      )}
    </div>
  );
}
