import type { NextRequest } from 'next/server';

// One-minute window per client IP. Counters live in this process, which is enough for a single server.
const WINDOW_MS = 60_000;
const MAX_KEYS = 50_000;
const hits = new Map<string, { count: number; reset: number }>();

// Caddy appends the address it saw, so the last entry is the one a client cannot forge
const clientIp = (req: NextRequest) => req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';

// returns the seconds to wait when the client is over the limit, otherwise 0
export function rateLimit(req: NextRequest, bucket: string, limit: number) {
  const now = Date.now();
  if (hits.size >= MAX_KEYS) {
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
    if (hits.size >= MAX_KEYS) hits.clear();
  }
  const key = `${bucket}:${clientIp(req)}`;
  const entry = hits.get(key);
  if (!entry || entry.reset <= now) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    return 0;
  }
  entry.count += 1;
  return entry.count > limit ? Math.ceil((entry.reset - now) / 1000) : 0;
}
