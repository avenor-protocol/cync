'use client';

import { useState } from 'react';
import { useAccount, useConnect, useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
import { chain } from '@/lib/chain';
import { isValidAmount } from '@/lib/action';

export type ActionMeta = {
  title: string;
  description: string;
  icon: string;
  recipient: string;
  amounts: string[];
};

const symbol = chain.nativeCurrency.symbol;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// no query = preview only
export function ActionCard({ meta, query }: { meta: ActionMeta; query?: string }) {
  const [amount, setAmount] = useState(meta.amounts[0] ?? '');
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, data: hash, reset } = useSendTransaction();
  const receipt = useWaitForTransactionReceipt({ hash, chainId: chain.id });

  const value = custom || amount;

  async function tip() {
    if (!query) return;
    setError('');
    reset();
    if (!isValidAmount(value)) return setError('Enter a valid amount');
    setBusy(true);
    try {
      let account = address;
      if (!isConnected) {
        const injected = connectors[0];
        if (!injected) throw new Error('No browser wallet found. Install MetaMask or Rabby.');
        account = (await connectAsync({ connector: injected, chainId: chain.id })).accounts[0];
      }
      if (chainId !== chain.id) await switchChainAsync({ chainId: chain.id });

      const res = await fetch(`/api/actions/tip?${query}&amount=${encodeURIComponent(value)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Could not build the transaction');

      const tx = json.transaction;
      await sendTransactionAsync({ to: tx.to, data: tx.data, value: BigInt(tx.value), chainId: tx.chainId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/rejected|denied/i.test(msg) ? 'Transaction cancelled in wallet' : msg.split('\n')[0]);
    } finally {
      setBusy(false);
    }
  }

  const explorer = hash ? `${chain.blockExplorers.default.url}/tx/${hash}` : '';

  return (
    <div className="card">
      <div className="card-top">
        {meta.icon ? <img className="avatar" src={meta.icon} alt="" /> : <div className="avatar" />}
        <div>
          <div className="card-title">{meta.title || 'Your action title'}</div>
          <div className="card-by">to {meta.recipient ? short(meta.recipient) : '0x…'}</div>
        </div>
      </div>

      {meta.description && <p className="card-desc">{meta.description}</p>}
      {!meta.description && <div style={{ height: 18 }} />}

      <div className="amounts">
        {meta.amounts.map(a => (
          <button key={a} className={!custom && amount === a ? 'on' : ''} onClick={() => { setAmount(a); setCustom(''); }}>
            {a} {symbol}
          </button>
        ))}
      </div>
      <div className="custom">
        <input placeholder={`Custom amount (${symbol})`} inputMode="decimal" value={custom} onChange={e => setCustom(e.target.value.trim())} />
      </div>

      <button className="btn btn-block" onClick={tip} disabled={!query || busy}>
        {busy ? 'Confirm in wallet…' : isConnected ? `Tip ${value || ''} ${symbol}` : 'Connect wallet & tip'}
      </button>

      {error && <div className="status err">{error}</div>}
      {hash && receipt.isLoading && <div className="status">Transaction sent — waiting for confirmation…</div>}
      {hash && receipt.isSuccess && (
        <div className="status ok">
          Tip confirmed ✓ <a href={explorer} target="_blank" rel="noreferrer">View on explorer</a>
        </div>
      )}
      {hash && receipt.isError && <div className="status err">Transaction failed. <a href={explorer} target="_blank" rel="noreferrer">Details</a></div>}

      <div className="meta">
        <span>Cync · {chain.name}</span>
        <span>{isConnected && address ? `Connected ${short(address)}` : 'You review & sign in your wallet'}</span>
      </div>
    </div>
  );
}
