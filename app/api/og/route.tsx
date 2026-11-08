import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { networkName } from '@/lib/chain';
import { previewLabel, readAction, shortAddress } from '@/lib/preview';
import { rateLimit } from '@/lib/rateLimit';

// 1200x630 card for link previews. With a valid action in the query it shows that action, otherwise the site card.
const size = { width: 1200, height: 630 };
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function logo(req: NextRequest) {
  try {
    const res = await fetch(new URL('/og-logo.png', req.url));
    if (!res.ok) return null;
    return `data:image/png;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}

// Google Fonts serves a TrueType subset with just these characters; the card falls back to the default font on failure
async function font(family: string, weight: number, text: string) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? { name: family, data: await res.arrayBuffer(), weight: weight as 400 | 700, style: 'normal' as const } : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const wait = rateLimit(req, 'og', 60);
  if (wait) return new Response('Too many requests', { status: 429, headers: { 'Retry-After': String(wait) } });
  const action = readAction(req.nextUrl.searchParams);
  const symbol = action?.token.symbol ?? '';
  const title = action ? clip(action.title, 70) : 'Onchain actions, one link away.';
  const sub = action
    ? clip(action.description || `to ${shortAddress(action.to)}`, 90)
    : 'Create a link. Share it anywhere. Complete it in your own wallet.';
  const chips = action ? action.amounts.map(a => `${a} ${symbol}`) : [];
  const label = action ? `${previewLabel[action.type]} · ${symbol}` : '';
  const footer = action ? 'Unverified · review & sign in your wallet' : 'by Avenor';
  const tagline = 'Transfer · Tip · Donate · USSD, USDC, S';
  const [src, sora, inter] = await Promise.all([
    logo(req),
    font('Sora', 700, `CYNC${title}${chips.join('')}`),
    font('Inter', 400, `${networkName}${label.toUpperCase()}${sub}${footer}${tagline}`),
  ]);
  const fonts = [sora, inter].filter(f => f !== null);
  const heading = sora ? 'Sora' : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '60px 72px', color: '#e7eaf6', backgroundColor: '#04060f', fontFamily: inter ? 'Inter' : undefined,
          backgroundImage:
            'radial-gradient(circle at 88% 0%, rgba(47, 91, 255, 0.45), transparent 55%), radial-gradient(circle at 0% 100%, rgba(155, 92, 255, 0.28), transparent 50%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {src && <img src={src} width={60} height={60} style={{ borderRadius: 14, marginRight: 18 }} />}
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 8, fontFamily: heading }}>CYNC</div>
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: '#38c8ff', border: '1px solid rgba(140, 160, 255, 0.3)', borderRadius: 999, padding: '8px 20px' }}>
            {networkName}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {label && (
            <div style={{ display: 'flex', fontSize: 24, color: '#8d95b8', letterSpacing: 4, marginBottom: 18 }}>{label.toUpperCase()}</div>
          )}
          <div style={{ display: 'flex', flexDirection: action ? 'row' : 'column', fontSize: title.length > 40 ? 56 : 70, fontWeight: 700, lineHeight: 1.12, fontFamily: heading }}>
            {action ? title : [<span key="1">Onchain actions,</span>, <span key="2">one link away.</span>]}
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: '#b6bedf', marginTop: 22 }}>{sub}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {action ? (
            <div style={{ display: 'flex' }}>
              {chips.map(c => (
                <div
                  key={c}
                  style={{
                    display: 'flex', fontSize: action.type === 'transfer' ? 38 : 28, fontWeight: 700, fontFamily: heading, marginRight: 14,
                    padding: action.type === 'transfer' ? '14px 30px' : '12px 26px', borderRadius: 16,
                    border: '1px solid rgba(140, 160, 255, 0.35)', backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: 26, color: '#8d95b8' }}>{tagline}</div>
          )}
          <div style={{ display: 'flex', fontSize: 22, color: '#8d95b8' }}>{footer}</div>
        </div>
      </div>
    ),
    { ...size, fonts, headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
