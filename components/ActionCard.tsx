'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BaseError, formatUnits, parseUnits, type Hex } from 'viem';
import { usePublicClient, useReadContract, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { chain, routerAddress } from '@/lib/chain';
import { actionCopy, isValidAmount, parseAction, type ActionType } from '@/lib/action';
import { routerAbi } from '@/lib/routerAbi';
import { testTokens, type Token } from '@/lib/tokens';
import { useWallet, walletError } from '@/lib/useWallet';
import { verifyTransactions, type Tx } from '@/lib/verify';

export type ActionMeta = {
  type: ActionType;
  title: string;
  description: string;
  icon: string;
  recipient: string;
  token: Token;
  amounts: string[];
  // set on real links only (not the create-page preview), after the signature was checked
  creator?: { status: 'valid'; address: `0x${string}` } | { status: 'unsigned' };
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// no query = preview only
export function ActionCard({ meta, query }: { meta: ActionMeta; query?: string }) {
  const [amount, setAmount] = useState(meta.amounts[0] ?? '');
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [hash, setHash] = useState<Hex>(); // the final payment tx, not the approval

  const { address, isConnected, connect } = useWallet();
  const { mutateAsync: sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient({ chainId: chain.id });
  const receipt = useWaitForTransactionReceipt({ hash, chainId: chain.id });

  const { symbol, decimals } = meta.token;
  const copy = actionCopy[meta.type];
  const fixed = meta.type === 'transfer'; // creator set the amount, payer cannot change it
  const value = fixed ? (meta.amounts[0] ?? '') : custom || amount;

  // what the payer sees before signing: full recipient, what they receive, and the fee
  const { data: feeBps } = useReadContract({
    address: routerAddress,
    abi: routerAbi,
    functionName: 'feeBps',
    chainId: chain.id,
    query: { enabled: !!routerAddress },
  });
  const split = useMemo(() => {
    if (!isValidAmount(value, decimals)) return undefined;
    const gross = parseUnits(value, decimals);
    const fee = (gross * BigInt(feeBps ?? 0)) / 10_000n; // same rounding as CyncRouter
    return { net: formatUnits(gross - fee, decimals), fee: formatUnits(fee, decimals) };
  }, [value, decimals, feeBps]);

  async function submit() {
    if (!query) return;
    setError('');
    setHash(undefined);
    if (!isValidAmount(value, decimals)) return setError('Enter a valid amount');
    setBusy('Confirm in wallet…');
    try {
      const account = await connect();

      const res = await fetch(`/api/actions/${meta.type}?${query}&amount=${encodeURIComponent(value)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Could not build the transaction');

      // never trust the server's transactions: rebuild the expectation from the link itself
      const action = parseAction(meta.type, new URLSearchParams(query));
      if ('error' in action) throw new Error(action.error);
      const txs: Tx[] = json.transactions;
      const blocked = verifyTransactions(action, value, txs);
      if (blocked) throw new Error(`Blocked for your safety: ${blocked}. Nothing was sent.`);

      // token payments may come as [approve, execute]; the payment spends the approval, so it waits for it
      for (const [i, tx] of txs.entries()) {
        const last = i === txs.length - 1;
        setBusy('Checking transaction…');
        await publicClient!.call({ account, to: tx.to, data: tx.data, value: BigInt(tx.value) }).catch((e: unknown) => {
          throw new Error(`This transaction would fail: ${e instanceof BaseError ? e.shortMessage : String(e)}`);
        });
        setBusy(txs.length > 1 ? `${tx.label} in wallet (${i + 1}/${txs.length})…` : 'Confirm in wallet…');
        const sent = await sendTransactionAsync({ to: tx.to, data: tx.data, value: BigInt(tx.value), chainId: tx.chainId });
        if (last) {
          setHash(sent);
        } else {
          setBusy(`Waiting for ${tx.label.toLowerCase()}…`);
          const r = await publicClient!.waitForTransactionReceipt({ hash: sent });
          if (r.status !== 'success') throw new Error(`${tx.label} failed`);
        }
      }
    } catch (e) {
      setError(walletError(e));
    } finally {
      setBusy('');
    }
  }

  const creator = meta.creator;
  const byRecipient = creator?.status === 'valid' && creator.address.toLowerCase() === meta.recipient.toLowerCase();
  const explorer = hash ? `${chain.blockExplorers.default.url}/tx/${hash}` : '';
  // testnet only: point a payer who is short on funds to the right faucet
  const faucet = meta.token.address ? (testTokens ? '/faucet' : '') : chain.id === 14601 ? 'https://testnet.soniclabs.com/account' : '';

  return (
    <div className="card">
      <div className="card-top">
        {meta.icon ? <img className="avatar" src={meta.icon} alt="" /> : <div className="avatar" />}
        <div>
          <div className="card-title">{meta.title || 'Your action title'}</div>
          {creator && (
            <div className={creator.status === 'valid' ? 'card-creator' : 'card-creator warn'}>
              {creator.status === 'unsigned'
                ? 'Creator not signed'
                : byRecipient ? 'Signed by the recipient' : `Signed by ${short(creator.address)}`}
            </div>
          )}
          <div className="card-by">
            to {meta.recipient ? short(meta.recipient) : '0x…'}
            {/* v1 has no Action Registry, so no link is verified yet */}
            <span className="unverified" title="Not checked by the Action Registry yet. Make sure you trust the recipient address below.">
              Unverified
            </span>
          </div>
        </div>
      </div>

      {meta.description && <p className="card-desc">{meta.description}</p>}
      {!meta.description && <div style={{ height: 18 }} />}

      {fixed ? (
        <div className="fixed-amount">
          <span>Amount</span>
          <b>{value || '0'} {symbol}</b>
        </div>
      ) : (
        <>
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
        </>
      )}

      <dl className="review">
        <dt>Recipient</dt>
        <dd className="addr">{meta.recipient || '0x…'}</dd>
        {creator && (
          <>
            <dt>Created by</dt>
            {creator.status === 'valid'
              ? <dd className="addr">{creator.address}</dd>
              : <dd className="note warn">Not signed: anyone could have made this link</dd>}
          </>
        )}
        <dt>Recipient gets</dt>
        <dd>{split ? `${split.net} ${symbol}` : '—'}</dd>
        {!!feeBps && (
          <>
            <dt>Cync fee ({feeBps / 100}%)</dt>
            <dd>{split ? `${split.fee} ${symbol}` : '—'}</dd>
          </>
        )}
      </dl>

      <button className="btn btn-block" onClick={submit} disabled={!query || !!busy}>
        {busy || (isConnected ? `${copy.verb} ${value || ''} ${symbol}` : `Connect wallet & ${copy.verb.toLowerCase()}`)}
      </button>

      {error && (
        <div className="status err">
          {error}
          {/insufficient/i.test(error) && faucet && (
            <> · <a href={faucet} target={meta.token.address ? undefined : '_blank'} rel="noreferrer">Get test {symbol}</a></>
          )}
        </div>
      )}
      {hash && receipt.isLoading && <div className="status">Transaction sent. Waiting for confirmation…</div>}
      {hash && receipt.isSuccess && (
        <>
          <div className="status ok">
            {copy.done} ✓ <a href={explorer} target="_blank" rel="noreferrer">View on explorer</a>
          </div>
          <div className="next-step">
            <span>Want to get paid like this?</span>
            <Link href="/create" className="btn btn-ghost">Create your own link</Link>
          </div>
        </>
      )}
      {hash && receipt.isError && <div className="status err">Transaction failed. <a href={explorer} target="_blank" rel="noreferrer">Details</a></div>}

      <div className="meta">
        <span>Cync · {chain.name}</span>
        <span>{isConnected && address ? `Connected ${short(address)}` : 'You review & sign in your wallet'}</span>
      </div>
    </div>
  );
}
