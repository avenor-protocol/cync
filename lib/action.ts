import { isAddress, keccak256, toHex } from 'viem';

export type TipAction = {
  to: `0x${string}`;
  title: string;
  description: string;
  icon?: string;
  amounts: string[];
};

const MAX_AMOUNT = 10_000;

export function isValidAmount(value: string) {
  const n = Number(value);
  return /^\d+(\.\d{1,18})?$/.test(value) && n > 0 && n <= MAX_AMOUNT;
}

export function parseTipAction(params: URLSearchParams): TipAction | { error: string } {
  const to = params.get('to') ?? '';
  if (!isAddress(to)) return { error: 'Invalid recipient address' };

  const title = (params.get('title') ?? '').trim().slice(0, 80);
  if (!title) return { error: 'Missing title' };

  const amounts = (params.get('amounts') ?? '1,5,10')
    .split(',')
    .map(a => a.trim())
    .filter(isValidAmount)
    .slice(0, 3);
  if (amounts.length === 0) return { error: 'No valid amounts' };

  const icon = params.get('icon') ?? undefined;
  return {
    to,
    title,
    description: (params.get('desc') ?? '').trim().slice(0, 280),
    icon: icon && /^https:\/\//.test(icon) ? icon : undefined,
    amounts,
  };
}

export function toQuery(action: TipAction) {
  const q = new URLSearchParams({ to: action.to, title: action.title, amounts: action.amounts.join(',') });
  if (action.description) q.set('desc', action.description);
  if (action.icon) q.set('icon', action.icon);
  return q.toString();
}

export function actionId(action: TipAction) {
  return keccak256(toHex(toQuery(action)));
}
