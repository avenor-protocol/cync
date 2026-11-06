import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, encodeFunctionData, erc20Abi, http, isAddress, parseUnits } from 'viem';
import { actionCopy, actionId, actionKind, isActionType, isValidAmount, parseAction, toQuery, type Action } from '@/lib/action';
import { chain, routerAddress } from '@/lib/chain';
import { routerAbi } from '@/lib/routerAbi';
import { checkCreator } from '@/lib/signature';
import type { Tx } from '@/lib/verify';

// GET -> action metadata, POST -> unsigned txs (similar to solana actions)
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const client = createPublicClient({ chain, transport: http() });

type Ctx = { params: Promise<{ type: string }> };

async function load(req: NextRequest, ctx: Ctx): Promise<Action | { error: string; status: number }> {
  const { type } = await ctx.params;
  if (!isActionType(type)) return { error: 'Unknown action type', status: 404 };
  const action = parseAction(type, req.nextUrl.searchParams);
  if ('error' in action) return { error: action.error, status: 400 };
  // a signed link whose fields were edited afterwards is refused outright
  const signed = await checkCreator(client, action);
  if (signed.status === 'invalid') return { error: 'This link was changed after its creator signed it', status: 400 };
  return { ...action, creator: signed.status === 'valid' ? signed.creator : undefined };
}

const fail = (message: string, status = 400) => NextResponse.json({ message }, { status, headers });

// a problem with this action or payer (shown as is), as opposed to an RPC failure
class ActionError extends Error {}

export function OPTIONS() {
  return new NextResponse(null, { headers });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const action = await load(req, ctx);
  if ('error' in action) return fail(action.error, action.status);

  const { symbol } = action.token;
  const copy = actionCopy[action.type];
  const base = `/api/actions/${action.type}?${toQuery(action)}`;
  const fixed = action.amounts.map(a => ({ label: `${copy.verb} ${a} ${symbol}`, href: `${base}&amount=${a}` }));
  const custom = {
    label: copy.verb,
    href: `${base}&amount={amount}`,
    parameters: [{ name: 'amount', label: `Custom amount (${symbol})` }],
  };

  return NextResponse.json(
    {
      type: 'action',
      actionType: action.type,
      icon: action.icon ?? '/logo.png',
      title: action.title,
      description: action.description,
      label: copy.label,
      recipient: action.to,
      creator: action.creator ?? null,
      token: action.token,
      chainId: chain.id,
      // a transfer has exactly one fixed amount, so it gets no custom-amount action
      links: { actions: action.type === 'transfer' ? fixed : [...fixed, custom] },
    },
    { headers },
  );
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const action = await load(req, ctx);
  if ('error' in action) return fail(action.error, action.status);

  // the creator fixes the amount of a transfer; the payer cannot change it
  const amount = action.type === 'transfer' ? action.amounts[0] : (req.nextUrl.searchParams.get('amount') ?? '');
  if (!isValidAmount(amount, action.token.decimals)) return fail('Invalid amount');

  const body = await req.json().catch(() => ({}));
  if (!isAddress(body.account ?? '')) return fail('Invalid account');

  const copy = actionCopy[action.type];
  const message = `${copy.verb} ${amount} ${action.token.symbol} to ${action.title}`;
  try {
    const transactions = action.token.address
      ? await tokenTransactions(action, parseUnits(amount, action.token.decimals), body.account, copy.verb)
      : [nativeTransaction(action, parseUnits(amount, action.token.decimals), copy.verb)];
    return NextResponse.json({ transactions, message }, { headers });
  } catch (e) {
    if (e instanceof ActionError) return fail(e.message);
    console.error(e);
    return fail('Could not reach the Sonic network, try again', 502);
  }
}

function nativeTransaction(action: Action, value: bigint, verb: string): Tx {
  const tx = { value: value.toString(), chainId: chain.id, label: verb };
  return routerAddress
    ? {
        ...tx,
        to: routerAddress,
        data: encodeFunctionData({ abi: routerAbi, functionName: 'execute', args: [actionKind(action.type), action.to, actionId(action)] }),
      }
    : { ...tx, to: action.to, data: '0x' };
}

// ERC-20: approve the router for exactly this amount when the allowance is short, then execute.
async function tokenTransactions(action: Action, amount: bigint, account: `0x${string}`, verb: string): Promise<Tx[]> {
  const token = action.token.address!;
  const base = { value: '0', chainId: chain.id };

  if (!routerAddress) {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [action.to, amount] });
    return [{ ...base, to: token, data, label: verb }];
  }

  const [decimals, balance, allowance, allowed] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
    client.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [account, routerAddress] }),
    client.readContract({ address: routerAddress, abi: routerAbi, functionName: 'allowedTokens', args: [token] }),
  ]);
  // a wrong address or decimals in the config would silently scale the amount
  if (decimals !== action.token.decimals) throw new ActionError(`${action.token.symbol} is misconfigured`);
  if (!allowed) throw new ActionError(`${action.token.symbol} is not enabled on the Cync Router`);
  if (balance < amount) throw new ActionError(`Insufficient ${action.token.symbol} balance`);

  const execute: Tx = {
    ...base,
    to: routerAddress,
    data: encodeFunctionData({
      abi: routerAbi,
      functionName: 'executeToken',
      args: [actionKind(action.type), token, action.to, amount, actionId(action)],
    }),
    label: verb,
  };
  if (allowance >= amount) return [execute];

  const approve: Tx = {
    ...base,
    to: token,
    data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [routerAddress, amount] }),
    label: `Approve ${action.token.symbol}`,
  };
  return [approve, execute];
}
