'use client';

import { useMemo, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { useReadContract, useSignTypedData } from 'wagmi';
import { ActionCard } from '@/components/ActionCard';
import { ACTION_TYPES, actionCopy, isValidAmount, parseAction, toQuery, type ActionType } from '@/lib/action';
import { chain, isMainnet, networkName, routerAddress } from '@/lib/chain';
import { routerAbi } from '@/lib/routerAbi';
import { typedAction } from '@/lib/signature';
import { defaultToken, tokens } from '@/lib/tokens';
import { useWallet, walletError } from '@/lib/useWallet';

const hints: Record<ActionType, (symbol: string) => string> = {
  transfer: s => `Request a fixed amount of ${s} on ${networkName}. Whoever opens the link pays exactly that amount.`,
  tip: s => `Anyone who opens the link can send you ${s} on ${networkName} without copying your address.`,
  donate: s => `Collect donations in ${s} on ${networkName}. Donors pick a suggested amount or enter their own.`,
};

export default function CreatePage() {
  const [type, setType] = useState<ActionType>('tip');
  const [token, setToken] = useState(defaultToken);
  const [to, setTo] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('');
  const [amounts, setAmounts] = useState('1, 5, 10');
  const [fixedAmount, setFixedAmount] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [signedBy, setSignedBy] = useState('');
  const [signError, setSignError] = useState('');
  const [signing, setSigning] = useState(false);
  const { connect } = useWallet();
  const { mutateAsync: signTypedDataAsync } = useSignTypedData();

  const isTransfer = type === 'transfer';
  const parsed = useMemo(
    () =>
      parseAction(
        type,
        new URLSearchParams({
          to,
          token: token.symbol,
          title,
          desc,
          icon,
          amounts: (isTransfer ? fixedAmount : amounts).replace(/\s/g, ''),
        }),
      ),
    [type, isTransfer, to, token, title, desc, icon, amounts, fixedAmount],
  );
  const error = 'error' in parsed ? parsed.error : '';

  // The payer always pays the amount shown; the router fee comes out of what the recipient receives.
  const { data: feeBps } = useReadContract({
    address: routerAddress,
    abi: routerAbi,
    functionName: 'feeBps',
    chainId: chain.id,
    query: { enabled: !!routerAddress },
  });
  const feeNote = (() => {
    if (!feeBps) return '';
    const pct = `${feeBps / 100}% Cync fee`;
    if (!isTransfer) return `A ${pct} is deducted from each payment you receive.`;
    if (!isValidAmount(fixedAmount, token.decimals)) return `A ${pct} is deducted from the amount you receive.`;
    const value = parseUnits(fixedAmount, token.decimals);
    const net = value - (value * BigInt(feeBps)) / 10_000n; // same rounding as CyncRouter
    return `The payer pays ${fixedAmount} ${token.symbol}. You receive ${formatUnits(net, token.decimals)} ${token.symbol} after the ${pct}.`;
  })();

  function publish(query: string, creator = '') {
    setLink(`${location.origin}/a?${query}`);
    setSignedBy(creator);
    setCopied(false);
  }

  // the signature lets payers see who made the link and makes any later edit to it detectable
  async function signAndGenerate() {
    if ('error' in parsed) return;
    setSignError('');
    setSigning(true);
    try {
      const creator = await connect();
      const sig = await signTypedDataAsync({ account: creator, ...typedAction(parsed) });
      publish(toQuery({ ...parsed, creator, sig }), creator);
    } catch (e) {
      setSignError(walletError(e));
    } finally {
      setSigning(false);
    }
  }

  function generateUnsigned() {
    if ('error' in parsed) return;
    publish(toQuery(parsed));
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  const preview = {
    type,
    title,
    description: desc,
    // same fallback as the API, so the preview matches the real link
    icon: /^https:\/\//.test(icon) ? icon : '/logo.png',
    recipient: to,
    token,
    amounts: 'error' in parsed ? (isTransfer ? [fixedAmount] : ['1', '5', '10']) : parsed.amounts,
  };

  return (
    <div className="create">
      <div>
        <h1>Create a <span className="grad">{actionCopy[type].label.toLowerCase()} link</span></h1>
        <p className="hint">{hints[type](token.symbol)}</p>

        <div className="types" role="radiogroup" aria-label="Action type">
          {ACTION_TYPES.map(t => (
            <button key={t} type="button" role="radio" aria-checked={t === type} className={t === type ? 'on' : ''}
              onClick={() => { setType(t); setLink(''); }}>
              {actionCopy[t].label}
            </button>
          ))}
        </div>

        {tokens.length > 1 && (
          <div className="types" role="radiogroup" aria-label="Token">
            {tokens.map(t => (
              <button key={t.symbol} type="button" role="radio" aria-checked={t === token} className={t === token ? 'on' : ''}
                onClick={() => { setToken(t); setLink(''); }}>
                {isMainnet && <img src={`/tokens/${t.symbol.toLowerCase()}.png`} alt="" width={20} height={20} className="token-logo" />}
                {t.symbol}
              </button>
            ))}
          </div>
        )}

        <label className="field">
          <span>Recipient address</span>
          <input placeholder="0x…" value={to} onChange={e => { setTo(e.target.value.trim()); setLink(''); }} />
        </label>
        <label className="field">
          <span>Title</span>
          <input placeholder={isTransfer ? 'Invoice #42: design work' : 'Support my open-source work'} maxLength={80} value={title}
            onChange={e => { setTitle(e.target.value); setLink(''); }} />
        </label>
        <label className="field">
          <span>Description (optional)</span>
          <textarea maxLength={280} value={desc} onChange={e => { setDesc(e.target.value); setLink(''); }} />
        </label>
        <label className="field">
          <span>Image URL (optional, https)</span>
          <input placeholder="https://…" value={icon} onChange={e => { setIcon(e.target.value.trim()); setLink(''); }} />
        </label>
        {isTransfer ? (
          <label className="field">
            <span>Amount in {token.symbol} (fixed, the payer cannot change it)</span>
            <input placeholder="25" inputMode="decimal" value={fixedAmount} onChange={e => { setFixedAmount(e.target.value.trim()); setLink(''); }} />
          </label>
        ) : (
          <label className="field">
            <span>Suggested amounts in {token.symbol} (up to 3, comma-separated)</span>
            <input value={amounts} onChange={e => { setAmounts(e.target.value); setLink(''); }} />
          </label>
        )}

        {feeNote && <p className="fee-note">{feeNote}</p>}
        {(to || title) && error && <div className="error">{error}</div>}
        <div className="row">
          <button className="btn" onClick={signAndGenerate} disabled={!!error || signing}>
            {signing ? 'Sign in your wallet…' : 'Sign & create link'}
          </button>
          <button className="btn btn-ghost" onClick={generateUnsigned} disabled={!!error || signing}>Create without signing</button>
        </div>
        {signError && <div className="error">{signError}</div>}

        {link && (
          <div className="linkbox">
            <div className="label">Your Cync link</div>
            <code>{link}</code>
            <p className="fee-note">
              {signedBy
                ? `Signed by ${signedBy}. Payers see this address, and any edit to the link breaks the signature.`
                : 'Not signed. Payers will see "Creator not signed".'}
            </p>
            <div className="row">
              <button className="btn" onClick={copy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
              <a className="btn btn-ghost" href={link} target="_blank" rel="noreferrer">Open</a>
            </div>
          </div>
        )}
      </div>

      <div className="sticky">
        <div className="label">Live preview</div>
        <ActionCard key={`${type}-${token.symbol}`} meta={preview} />
      </div>
    </div>
  );
}
