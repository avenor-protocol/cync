import type { Metadata } from 'next';
import { Suspense } from 'react';
import { imageQuery, previewDescription, previewLabel, readAction } from '@/lib/preview';
import { ActionView } from './ActionView';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// the link preview on X / Telegram / Discord: title, amounts, and a generated card image
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (v !== undefined) params.set(k, Array.isArray(v) ? v[0] : v);
  const action = readAction(params);
  // payment links stay out of search results; robots.txt must still allow them or X cannot read the preview
  const robots = { index: false };
  if (!action) return { robots }; // invalid link: the site card from the layout

  const title = `${action.title} · ${previewLabel[action.type]} on Cync`;
  const description = previewDescription(action);
  const image = { url: `/api/og?${imageQuery(action)}`, width: 1200, height: 630, alt: action.title };
  return {
    title,
    description,
    robots,
    openGraph: { title, description, images: [image], type: 'website', siteName: 'Cync' },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export default function ActionPage() {
  return (
    <Suspense fallback={<div className="center"><span className="hint">Loading action…</span></div>}>
      <ActionView />
    </Suspense>
  );
}
