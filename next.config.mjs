/** @type {import('next').NextConfig} */
const empty = './lib/stubs/empty.js';

const isDev = process.env.NODE_ENV !== 'production';
const rpcOrigin = new URL(process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.soniclabs.com').origin;
const walletConnect = ['walletconnect.org', 'walletconnect.com', 'reown.com', 'web3modal.org', 'web3modal.com'];

const csp = [
  "default-src 'self'",
  // Next's bootstrap scripts are inline; the dev server also needs eval
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src \'self\' data: https://fonts.gstatic.com https://fonts.reown.com',
  // action links can point their icon at any https image
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${rpcOrigin} ${walletConnect.flatMap(d => [`https://*.${d}`, `wss://*.${d}`]).join(' ')}${isDev ? ' ws:' : ''}`,
  "frame-src https://verify.walletconnect.org https://verify.walletconnect.com https://secure.walletconnect.org https://secure.walletconnect.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // this page asks wallets to sign, so no other site may frame it
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // self-contained server in .next/standalone, used by the Dockerfile
  output: 'standalone',
  turbopack: {
    // optional deps from wallet sdks
    resolveAlias: { 'pino-pretty': empty, lokijs: empty, encoding: empty },
  },
};

export default nextConfig;
