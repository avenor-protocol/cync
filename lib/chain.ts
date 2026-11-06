import { defineChain } from 'viem';

// sonic testnet (docs.soniclabs.com), can be overridden from .env.local
export const chain = defineChain({
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 14601),
  name: 'Sonic Testnet',
  nativeCurrency: { decimals: 18, name: 'Sonic', symbol: 'S' },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.soniclabs.com'] } },
  blockExplorers: {
    default: {
      name: 'Explorer',
      url: (process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://testnet.sonicscan.org').replace(/\/$/, ''),
    },
  },
  testnet: true,
});

// if not set, tips go directly to the recipient
export const routerAddress = (process.env.NEXT_PUBLIC_ROUTER_ADDRESS || undefined) as `0x${string}` | undefined;

export const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || undefined;
