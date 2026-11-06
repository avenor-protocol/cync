import Link from 'next/link';
import { defaultToken } from '@/lib/tokens';

const sample = process.env.NEXT_PUBLIC_SAMPLE_RECIPIENT;
const sampleLink = sample
  ? `/a?${new URLSearchParams({
      type: 'tip',
      to: sample,
      token: defaultToken.symbol,
      title: 'Support Avenor builders',
      desc: 'Every tip helps us ship Cync on Sonic.',
      amounts: '1,5,10',
    })}`
  : null;

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Onchain actions,<br /><span className="grad">one link away.</span></h1>
        <p>Create a link and share it anywhere. Whoever opens it can review and complete the action on Sonic, in their own wallet.</p>
        <div className="row">
          <Link href="/create" className="btn">Create a link</Link>
          {sampleLink && <Link href={sampleLink} className="btn btn-ghost">Try a live example</Link>}
        </div>
      </section>
      <section className="how">
        <div><b>1 · Create</b><span>Pick a transfer, tip, or donation. Set the recipient, title, and amount.</span></div>
        <div><b>2 · Share</b><span>Post the link on X, Telegram, Discord, or your site.</span></div>
        <div><b>3 · Complete</b><span>Supporters connect a wallet, review, and sign. Keys never leave their wallet.</span></div>
      </section>
    </>
  );
}
