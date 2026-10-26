import { NextRequest, NextResponse } from 'next/server';
import { encodeFunctionData, isAddress, parseEther } from 'viem';
import { actionId, isValidAmount, parseTipAction, toQuery } from '@/lib/action';
import { chain, routerAddress } from '@/lib/chain';
import { routerAbi } from '@/lib/routerAbi';

// GET -> action metadata, POST -> unsigned tx (similar to solana actions)
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new NextResponse(null, { headers });
}

export function GET(req: NextRequest) {
  const action = parseTipAction(req.nextUrl.searchParams);
  if ('error' in action) return NextResponse.json({ message: action.error }, { status: 400, headers });

  const base = `/api/actions/tip?${toQuery(action)}`;
  return NextResponse.json(
    {
      type: 'action',
      icon: action.icon ?? '/logo.png',
      title: action.title,
      description: action.description,
      label: 'Tip',
      recipient: action.to,
      chainId: chain.id,
      links: {
        actions: [
          ...action.amounts.map(a => ({ label: `${a} ${chain.nativeCurrency.symbol}`, href: `${base}&amount=${a}` })),
          {
            label: 'Send tip',
            href: `${base}&amount={amount}`,
            parameters: [{ name: 'amount', label: `Custom amount (${chain.nativeCurrency.symbol})` }],
          },
        ],
      },
    },
    { headers },
  );
}

export async function POST(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const action = parseTipAction(params);
  if ('error' in action) return NextResponse.json({ message: action.error }, { status: 400, headers });

  const amount = params.get('amount') ?? '';
  if (!isValidAmount(amount)) return NextResponse.json({ message: 'Invalid amount' }, { status: 400, headers });

  const body = await req.json().catch(() => ({}));
  if (!isAddress(body.account ?? '')) return NextResponse.json({ message: 'Invalid account' }, { status: 400, headers });

  const value = parseEther(amount);
  const transaction = routerAddress
    ? {
        to: routerAddress,
        data: encodeFunctionData({ abi: routerAbi, functionName: 'tip', args: [action.to, actionId(action)] }),
        value: value.toString(),
        chainId: chain.id,
      }
    : { to: action.to, data: '0x', value: value.toString(), chainId: chain.id };

  return NextResponse.json(
    { transaction, message: `Tip ${amount} ${chain.nativeCurrency.symbol} to ${action.title}` },
    { headers },
  );
}
