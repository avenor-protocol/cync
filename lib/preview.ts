import { isActionType, parseAction, type Action, type ActionType } from '@/lib/action';
import { networkName } from '@/lib/chain';

// What a shared link shows on X, Telegram, Discord: built from the link alone, with no RPC calls.
// The creator signature is not checked here, so the preview never claims who made the link.

export const previewLabel: Record<ActionType, string> = {
  transfer: 'Payment request',
  tip: 'Tip',
  donate: 'Donation',
};

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function readAction(params: URLSearchParams): Action | null {
  // links created before action types existed carry no type and are tips
  const type = params.get('type') ?? 'tip';
  if (!isActionType(type)) return null;
  const action = parseAction(type, params);
  return 'error' in action ? null : action;
}

export function previewDescription(action: Action) {
  const { symbol } = action.token;
  const amounts = action.amounts.map(a => `${a} ${symbol}`).join(' / ');
  const summary = {
    transfer: `Pay ${amounts} to ${shortAddress(action.to)} on ${networkName}.`,
    tip: `Tip ${amounts} or any amount on ${networkName}.`,
    donate: `Donate ${amounts} or any amount on ${networkName}.`,
  }[action.type];
  return action.description ? `${action.description.replace(/[\s.]+$/, '')} · ${summary}` : summary;
}

// only the fields the image draws, so the image URL stays short (no signature)
export function imageQuery(action: Action) {
  const q = new URLSearchParams({
    type: action.type,
    to: action.to,
    token: action.token.symbol,
    title: action.title,
    amounts: action.amounts.join(','),
  });
  if (action.description) q.set('desc', action.description);
  return q.toString();
}
