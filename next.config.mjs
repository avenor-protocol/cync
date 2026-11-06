/** @type {import('next').NextConfig} */
const empty = './lib/stubs/empty.js';

const nextConfig = {
  reactStrictMode: true,
  // self-contained server in .next/standalone, used by the Dockerfile
  output: 'standalone',
  turbopack: {
    // optional deps from wallet sdks
    resolveAlias: { 'pino-pretty': empty, lokijs: empty, encoding: empty },
  },
};

export default nextConfig;
