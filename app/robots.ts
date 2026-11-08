import type { MetadataRoute } from 'next';
import { publicUrl } from '@/lib/site';

// /a and /api/og stay allowed: X and other preview bots obey this file and need them to build link cards
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/actions/' },
    sitemap: `${publicUrl}/sitemap.xml`,
  };
}
