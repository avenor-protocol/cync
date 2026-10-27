'use client';

import { useMemo, useState } from 'react';
import { ActionCard } from '@/components/ActionCard';
import { parseTipAction, toQuery } from '@/lib/action';

export default function CreatePage() {
  const [to, setTo] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('');
  const [amounts, setAmounts] = useState('1, 5, 10');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(
    () => parseTipAction(new URLSearchParams({ to, title, desc, icon, amounts: amounts.replace(/\s/g, '') })),
    [to, title, desc, icon, amounts],
  );
  const error = 'error' in parsed ? parsed.error : '';

  function generate() {
    if ('error' in parsed) return;
    setLink(`${location.origin}/a?${toQuery(parsed)}`);
    setCopied(false);
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  const preview = {
    title,
    description: desc,
    icon: /^https:\/\//.test(icon) ? icon : '',
    recipient: to,
    amounts: 'error' in parsed ? ['1', '5', '10'] : parsed.amounts,
  };

  return (
    <div className="create">
      <div>
        <h1>Create a <span className="grad">tip link</span></h1>
        <p className="hint">Anyone who opens the link can send you S on Sonic testnet — no address copying.</p>

        <label className="field">
          <span>Recipient address</span>
          <input placeholder="0x…" value={to} onChange={e => { setTo(e.target.value.trim()); setLink(''); }} />
        </label>
        <label className="field">
          <span>Title</span>
          <input placeholder="Support my open-source work" maxLength={80} value={title} onChange={e => { setTitle(e.target.value); setLink(''); }} />
        </label>
        <label className="field">
          <span>Description (optional)</span>
          <textarea maxLength={280} value={desc} onChange={e => { setDesc(e.target.value); setLink(''); }} />
        </label>
        <label className="field">
          <span>Image URL (optional, https)</span>
          <input placeholder="https://…" value={icon} onChange={e => { setIcon(e.target.value.trim()); setLink(''); }} />
        </label>
        <label className="field">
          <span>Suggested amounts in S (up to 3, comma-separated)</span>
          <input value={amounts} onChange={e => { setAmounts(e.target.value); setLink(''); }} />
        </label>

        {(to || title) && error && <div className="error">{error}</div>}
        <button className="btn" onClick={generate} disabled={!!error}>Generate link</button>

        {link && (
          <div className="linkbox">
            <div className="label">Your Cync link</div>
            <code>{link}</code>
            <div className="row">
              <button className="btn" onClick={copy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
              <a className="btn btn-ghost" href={link} target="_blank" rel="noreferrer">Open</a>
            </div>
          </div>
        )}
      </div>

      <div className="sticky">
        <div className="label">Live preview</div>
        <ActionCard meta={preview} />
      </div>
    </div>
  );
}
