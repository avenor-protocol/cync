'use client';

import { useConnect, useConnection, useConnectors, useSwitchChain } from 'wagmi';
import { chain } from '@/lib/chain';

// Connects a browser wallet (WalletConnect as fallback), switches to Sonic, and returns the account.
export function useWallet() {
  const { address, isConnected, chainId } = useConnection();
  const { mutateAsync: connectAsync } = useConnect();
  const connectors = useConnectors();
  const { mutateAsync: switchChainAsync } = useSwitchChain();

  async function connect(): Promise<`0x${string}`> {
    let account = address;
    let currentChainId = chainId;
    if (!isConnected || !account) {
      const injected = connectors.find(c => c.id === 'injected');
      const connector = (await injected?.getProvider()) ? injected : connectors.find(c => c.id === 'walletConnect');
      if (!connector) throw new Error('No browser wallet found. Install MetaMask or Rabby.');
      const connection = await connectAsync({ connector, chainId: chain.id });
      account = connection.accounts[0];
      currentChainId = connection.chainId;
    }
    if (currentChainId !== chain.id) await switchChainAsync({ chainId: chain.id });
    return account;
  }

  return { address, isConnected, connect };
}

// wallets report a user cancel in different words
export const walletError = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  return /rejected|denied/i.test(msg) ? 'Cancelled in wallet' : msg.split('\n')[0];
};
