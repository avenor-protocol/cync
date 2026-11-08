import { defineChain } from 'viem';

const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 14601);
export const isMainnet = id === 146;
// how the network is named in page copy and link previews
export const networkName = isMainnet ? 'Sonic' : 'Sonic testnet';

// docs.soniclabs.com; RPC and explorer can be overridden from the env file
const defaultRpc = isMainnet ? 'https://rpc.soniclabs.com' : 'https://rpc.testnet.soniclabs.com';
const defaultExplorer = isMainnet ? 'https://sonicscan.org' : 'https://testnet.sonicscan.org';

export const chain = defineChain({
  id,
  name: isMainnet ? 'Sonic' : 'Sonic Testnet',
  nativeCurrency: { decimals: 18, name: 'Sonic', symbol: 'S' },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL || defaultRpc] } },
  blockExplorers: {
    default: {
      name: 'Explorer',
      url: (process.env.NEXT_PUBLIC_EXPLORER_URL || defaultExplorer).replace(/\/$/, ''),
    },
  },
  testnet: !isMainnet,
});

// if not set, tips go directly to the recipient
export const routerAddress = (process.env.NEXT_PUBLIC_ROUTER_ADDRESS || undefined) as `0x${string}` | undefined;

export const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || undefined;
