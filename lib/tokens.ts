import { isAddress } from 'viem';
import { chain } from '@/lib/chain';

export type Token = {
  symbol: string;
  decimals: number;
  address?: `0x${string}`; // undefined = native S
};

const addr = (v?: string) => (v && isAddress(v) ? v : undefined);

// ERC-20s are enabled by setting their address; the API checks the decimals onchain before building a transaction.
// USSD is listed first, so it is the default whenever it is configured.
export const tokens: Token[] = [
  { symbol: 'USSD', decimals: 18, address: addr(process.env.NEXT_PUBLIC_USSD_ADDRESS) },
  { symbol: 'USDC', decimals: 6, address: addr(process.env.NEXT_PUBLIC_USDC_ADDRESS) },
  { symbol: chain.nativeCurrency.symbol, decimals: chain.nativeCurrency.decimals },
].filter(t => t.address || t.symbol === chain.nativeCurrency.symbol);

export const nativeToken = tokens[tokens.length - 1];
export const defaultToken = tokens[0];

export const findToken = (symbol: string) => tokens.find(t => t.symbol === symbol);

// set when the ERC-20s above are the testnet TestTokens (contracts/testnet), which anyone can mint with drip()
export const testTokens = process.env.NEXT_PUBLIC_TEST_TOKENS === '1' && tokens.some(t => t.address);

export const testTokenAbi = [
  { type: 'function', name: 'drip', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'dripAmount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;
