import { zeroAddress, type PublicClient } from 'viem';
import type { Action } from '@/lib/action';
import { chain } from '@/lib/chain';

// EIP-712 so the creator's wallet shows every field it is signing
export const actionTypes = {
  Action: [
    { name: 'kind', type: 'string' },
    { name: 'recipient', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'title', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'icon', type: 'string' },
    { name: 'amounts', type: 'string' },
  ],
} as const;

export function typedAction(action: Action) {
  return {
    domain: { name: 'Cync', version: '1', chainId: chain.id },
    types: actionTypes,
    primaryType: 'Action' as const,
    message: {
      kind: action.type,
      recipient: action.to,
      // the token contract, not its symbol, so a link cannot be re-pointed at another token
      token: action.token.address ?? zeroAddress,
      title: action.title,
      description: action.description,
      icon: action.icon ?? '',
      amounts: action.amounts.join(','),
    },
  };
}

export type CreatorCheck = { status: 'unsigned' } | { status: 'valid'; creator: `0x${string}` } | { status: 'invalid' };

// publicClient.verifyTypedData also accepts contract wallets (ERC-1271), e.g. a project's Safe
export async function checkCreator(client: PublicClient, action: Action): Promise<CreatorCheck> {
  if (!action.creator || !action.sig) return { status: 'unsigned' };
  const ok = await client
    .verifyTypedData({ address: action.creator, signature: action.sig, ...typedAction(action) })
    .catch(() => false);
  return ok ? { status: 'valid', creator: action.creator } : { status: 'invalid' };
}
