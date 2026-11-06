import { isAddress, isHex, keccak256, toHex, type Hex } from 'viem';
import { findToken, nativeToken, type Token } from '@/lib/tokens';

// order matches CyncRouter.ActionKind (Transfer = 0, Tip = 1, Donate = 2)
export const ACTION_TYPES = ['transfer', 'tip', 'donate'] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const isActionType = (value: unknown): value is ActionType => ACTION_TYPES.includes(value as ActionType);
export const actionKind = (type: ActionType) => ACTION_TYPES.indexOf(type);

// tip / donate: payer picks a suggested or custom amount. transfer: one fixed amount set by the creator.
export const actionCopy: Record<ActionType, { label: string; verb: string; done: string }> = {
  transfer: { label: 'Transfer', verb: 'Pay', done: 'Payment confirmed' },
  tip: { label: 'Tip', verb: 'Tip', done: 'Tip confirmed' },
  donate: { label: 'Donation', verb: 'Donate', done: 'Donation confirmed' },
};

export type Action = {
  type: ActionType;
  to: `0x${string}`;
  token: Token;
  title: string;
  description: string;
  icon?: string;
  amounts: string[];
  // optional EIP-712 signature by whoever created the link (see lib/signature.ts)
  creator?: `0x${string}`;
  sig?: Hex;
};

const MAX_AMOUNT = 10_000;

export function isValidAmount(value: string, decimals = 18) {
  const n = Number(value);
  return new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`).test(value) && n > 0 && n <= MAX_AMOUNT;
}

export function parseAction(type: ActionType, params: URLSearchParams): Action | { error: string } {
  const to = params.get('to') ?? '';
  if (!isAddress(to)) return { error: 'Invalid recipient address' };

  // links created before token support carry no token and pay in native S
  const token = findToken(params.get('token') ?? nativeToken.symbol);
  if (!token) return { error: 'Unsupported token' };

  const title = (params.get('title') ?? '').trim().slice(0, 80);
  if (!title) return { error: 'Missing title' };

  const amounts = (params.get('amounts') ?? (type === 'transfer' ? '' : '1,5,10'))
    .split(',')
    .map(a => a.trim())
    .filter(a => isValidAmount(a, token.decimals))
    .slice(0, type === 'transfer' ? 1 : 3);
  if (amounts.length === 0) return { error: type === 'transfer' ? 'Invalid amount' : 'No valid amounts' };

  const creator = params.get('creator') ?? undefined;
  const sig = params.get('sig') ?? undefined;
  if (creator !== undefined || sig !== undefined) {
    if (!creator || !isAddress(creator) || !sig || !isHex(sig)) return { error: 'Invalid creator signature' };
  }

  const icon = params.get('icon') ?? undefined;
  return {
    type,
    to,
    token,
    title,
    description: (params.get('desc') ?? '').trim().slice(0, 280),
    icon: icon && /^https:\/\//.test(icon) ? icon : undefined,
    amounts,
    creator: creator as `0x${string}` | undefined,
    sig: sig as Hex | undefined,
  };
}

// type and token are part of the query, so each combination gets its own actionId
export function toQuery(action: Action) {
  const q = new URLSearchParams({
    type: action.type,
    to: action.to,
    token: action.token.symbol,
    title: action.title,
    amounts: action.amounts.join(','),
  });
  if (action.description) q.set('desc', action.description);
  if (action.icon) q.set('icon', action.icon);
  if (action.creator && action.sig) {
    q.set('creator', action.creator);
    q.set('sig', action.sig);
  }
  return q.toString();
}

export function actionId(action: Action) {
  return keccak256(toHex(toQuery(action)));
}
