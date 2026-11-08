'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { PublicClient } from 'viem';
import { usePublicClient } from 'wagmi';
import { ActionCard, type ActionMeta } from '@/components/ActionCard';
import { isActionType, parseAction } from '@/lib/action';
import { chain } from '@/lib/chain';
import { checkCreator } from '@/lib/signature';

// A tampered link gets a warning, a broken one a way forward, a network failure a retry.
function LinkError({ message }: { message: string }) {
  const tampered = /changed after|do not match/i.test(message);
  const network = !tampered && /reach the Sonic network|failed to fetch|networkerror|load failed/i.test(message);
  const busy = /too many requests/i.test(message);
  const retry = network || busy;
  const [title, hint] = tampered
    ? ['Do not pay this link', 'Ask the creator for the original link, and only pay links shared on their official channels.']
    : busy
      ? ['Please wait a moment', 'Your link is fine. Too many requests came from your connection.']
      : network
        ? ['Could not load this link', 'The Sonic network could not be reached. Check your connection and try again.']
        : ["This link can't be opened",'It may be incomplete or mistyped. Ask the sender for the full link, or create your own.'];
  return (
    <div className="center">
      <div className={tampered ? 'link-error danger' : 'link-error'}>
        <h1>{title}</h1>
        <div className="status err">{message}</div>
        <p className="hint">{hint}</p>
        <div className="row">
          {retry && <button className="btn" onClick={() => location.reload()}>Try again</button>}
          {!retry && !tampered && <Link href="/create" className="btn">Create a link</Link>}
          <Link href="/" className={tampered ? 'btn' : 'btn btn-ghost'}>Home</Link>
        </div>
      </div>
    </div>
  );
}

export function ActionView() {
  const params = useSearchParams();
  const query = params.toString();
  // links created before action types existed carry no type and are tips
  const type = params.get('type') ?? 'tip';
  const api = `/api/actions/${isActionType(type) ? type : 'unknown'}?${query}`;
  const [meta, setMeta] = useState<ActionMeta | null>(null);
  const [error, setError] = useState('');
  const client = usePublicClient({ chainId: chain.id }) as PublicClient;

  useEffect(() => {
    fetch(api)
      .then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.message);
        // what gets paid (type, recipient, token, amounts) comes from the link; the server's copy must agree with it
        const link = parseAction(isActionType(type) ? type : 'tip', params);
        if ('error' in link) throw new Error(link.error);
        const serverAmounts = json.links.actions
          .filter((a: { parameters?: unknown }) => !a.parameters)
          .map((a: { href: string }) => new URL(a.href, location.origin).searchParams.get('amount'));
        if (json.actionType !== link.type || json.recipient?.toLowerCase() !== link.to.toLowerCase() ||
          json.token?.symbol !== link.token.symbol || serverAmounts.join(',') !== link.amounts.join(',')) {
          throw new Error('The action details from the server do not match this link. Do not continue.');
        }
        // the signature is checked here too, not taken from the server
        const signed = await checkCreator(client, link);
        if (signed.status === 'invalid') throw new Error('This link was changed after its creator signed it. Do not continue.');
        const creator = signed.status === 'valid' ? signed.creator : null;
        if ((json.creator ?? null)?.toLowerCase() !== creator?.toLowerCase()) {
          throw new Error('The action details from the server do not match this link. Do not continue.');
        }
        setMeta({
          type: link.type,
          title: json.title,
          description: json.description,
          icon: json.icon,
          recipient: link.to,
          token: link.token,
          amounts: link.amounts,
          creator: creator ? { status: 'valid', address: creator } : { status: 'unsigned' },
        });
      })
      .catch(e => setError(e.message || 'This action link is invalid'));
  }, [api, type, params, client]);

  if (error) return <LinkError message={error} />;
  if (!meta) return <div className="center"><span className="hint">Loading action…</span></div>;

  return (
    <div className="center">
      <div style={{ width: '100%' }}>
        <ActionCard meta={meta} query={query} />
        <p className="api-note">
          Powered by the Cync Action API ·{' '}
          <a href={api} target="_blank" rel="noreferrer">view raw action</a>
        </p>
      </div>
    </div>
  );
}
