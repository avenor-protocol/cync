export const contactEmail = 'avenor.protocol@gmail.com';

export const socialLinks = [
  { label: 'X', href: 'https://x.com/Avenor_Protocol' },
  { label: 'Telegram', href: 'https://t.me/avenor_protocol' },
  { label: 'GitHub', href: 'https://github.com/avenor-protocol' },
];

// absolute base for robots.txt and sitemap.xml
export const publicUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')
).replace(/\/$/, '');
