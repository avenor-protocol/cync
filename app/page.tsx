import Link from 'next/link';

const sample = process.env.NEXT_PUBLIC_SAMPLE_RECIPIENT;
const sampleLink = sample
  ? `/a?${new URLSearchParams({
      to: sample,
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
        <p>Create a link. Share it anywhere. Whoever opens it can review and complete the action in their own wallet — on Sonic.</p>
        <div className="row">
          <Link href="/create" className="btn">Create a tip link</Link>
          {sampleLink && <Link href={sampleLink} className="btn btn-ghost">Try a live example</Link>}
        </div>
      </section>
      <section className="how">
        <div><b>1 · Create</b><span>Set the recipient, title, and suggested amounts.</span></div>
        <div><b>2 · Share</b><span>Post the link on X, Telegram, Discord, or your site.</span></div>
        <div><b>3 · Complete</b><span>Supporters connect a wallet, review, and sign. Keys never leave their wallet.</span></div>
      </section>
    </>
  );
}
