import { decodeFunctionData, erc20Abi, parseUnits, type Abi, type Hex } from 'viem';
import { actionId, actionKind, type Action } from '@/lib/action';
import { chain, routerAddress } from '@/lib/chain';
import { routerAbi } from '@/lib/routerAbi';

export type Tx = { to: `0x${string}`; data: Hex; value: string; chainId: number; label: string };

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

// loosely typed on purpose: every field is compared against an expected value below
function decode(abi: Abi, data: Hex): { functionName: string; args: readonly unknown[] } | undefined {
  try {
    const { functionName, args } = decodeFunctionData({ abi, data });
    return { functionName, args: args ?? [] };
  } catch {
    return undefined;
  }
}

/**
 * Checks the transactions the Action API returned against what the link itself describes, so a compromised
 * or buggy server cannot make the Viewer send funds elsewhere, send a different amount, or ask for an unlimited
 * approval. `action` must be parsed from the link, not from the API response.
 * Returns the reason to block, or undefined when every transaction is exactly what the action needs.
 */
export function verifyTransactions(action: Action, amount: string, txs: Tx[]): string | undefined {
  try {
    return check(action, amount, txs);
  } catch {
    return 'the server returned a malformed transaction';
  }
}

function check(action: Action, amount: string, txs: Tx[]): string | undefined {
  if (!txs?.length) return 'the server returned no transaction';
  if (txs.some(tx => tx.chainId !== chain.id)) return `a transaction is not for ${chain.name}`;

  const value = parseUnits(amount, action.token.decimals);
  const token = action.token.address;
  const [pay, ...rest] = [...txs].reverse();
  const extra = rest.reverse();

  if (!routerAddress) {
    // demo mode without a router: one plain transfer straight to the recipient
    if (extra.length) return 'unexpected extra transactions';
    if (!token) {
      return same(pay.to, action.to) && pay.data === '0x' && BigInt(pay.value) === value
        ? undefined
        : 'the transfer does not match this link';
    }
    const call = decode(erc20Abi, pay.data);
    return same(pay.to, token) && BigInt(pay.value) === 0n && call?.functionName === 'transfer' &&
      same(call.args[0] as string, action.to) && call.args[1] === value
      ? undefined
      : 'the token transfer does not match this link';
  }

  if (!same(pay.to, routerAddress)) return 'the payment does not go to the official Cync Router';
  const call = decode(routerAbi, pay.data);
  const id = actionId(action);
  const kind = actionKind(action.type);

  if (!token) {
    if (extra.length) return 'unexpected extra transactions';
    return call?.functionName === 'execute' && BigInt(pay.value) === value &&
      call.args[0] === kind && same(call.args[1] as string, action.to) && call.args[2] === id
      ? undefined
      : 'the payment does not match this link';
  }

  if (!(call?.functionName === 'executeToken' && BigInt(pay.value) === 0n && call.args[0] === kind &&
    same(call.args[1] as string, token) && same(call.args[2] as string, action.to) && call.args[3] === value && call.args[4] === id)) {
    return 'the payment does not match this link';
  }
  // the only allowed extra step: approve the router for exactly this amount (never unlimited, never another spender)
  if (extra.length > 1) return 'unexpected extra transactions';
  if (extra.length === 1) {
    const [approve] = extra;
    const a = decode(erc20Abi, approve.data);
    if (!(same(approve.to, token) && BigInt(approve.value) === 0n && a?.functionName === 'approve' &&
      same(a.args[0] as string, routerAddress) && a.args[1] === value)) {
      return 'the approval is not limited to this payment and the Cync Router';
    }
  }
  return undefined;
}
