'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { chain, wcProjectId } from '@/lib/chain';

const config = createConfig({
  chains: [chain],
  connectors:
    wcProjectId && typeof window !== 'undefined'
      ? [injected(), walletConnect({ projectId: wcProjectId })]
      : [injected()],
  transports: { [chain.id]: http() },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
