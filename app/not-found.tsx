import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Page not found · Cync' };

export default function NotFound() {
  return (
    <div className="center">
      <div className="notfound">
        <div className="notfound-code grad">404</div>
        <h1>This page doesn&apos;t exist</h1>
        <p className="hint">The address may be mistyped or cut off. Cync action links start with <code>/a?</code>.</p>
        <div className="row">
          <Link href="/create" className="btn">Create a link</Link>
          <Link href="/" className="btn btn-ghost">Home</Link>
        </div>
      </div>
    </div>
  );
}
