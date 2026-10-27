'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ActionCard, type ActionMeta } from '@/components/ActionCard';

function ActionView() {
  const params = useSearchParams();
  const query = params.toString();
  const [meta, setMeta] = useState<ActionMeta | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/actions/tip?${query}`)
      .then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.message);
        setMeta({
          title: json.title,
          description: json.description,
          icon: json.icon,
          recipient: json.recipient,
          amounts: json.links.actions.filter((a: { parameters?: unknown }) => !a.parameters).map((a: { href: string }) =>
            new URL(a.href, location.origin).searchParams.get('amount'),
          ),
        });
      })
      .catch(e => setError(e.message || 'This action link is invalid'));
  }, [query]);

  if (error) return <div className="center"><div className="status err">{error}</div></div>;
  if (!meta) return <div className="center"><span className="hint">Loading action…</span></div>;

  return (
    <div className="center">
      <div style={{ width: '100%' }}>
        <ActionCard meta={meta} query={query} />
        <p className="api-note">
          Powered by the Cync Action API ·{' '}
          <a href={`/api/actions/tip?${query}`} target="_blank" rel="noreferrer">view raw action</a>
        </p>
      </div>
    </div>
  );
}

export default function ActionPage() {
  return (
    <Suspense fallback={<div className="center"><span className="hint">Loading action…</span></div>}>
      <ActionView />
    </Suspense>
  );
}
