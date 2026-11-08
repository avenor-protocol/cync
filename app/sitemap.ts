import type { MetadataRoute } from 'next';
import { publicUrl } from '@/lib/site';
import { testTokens } from '@/lib/tokens';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/create', ...(testTokens ? ['/faucet'] : []), '/terms', '/privacy'].map(path => ({ url: `${publicUrl}${path}` }));
}
