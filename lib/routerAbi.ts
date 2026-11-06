// kind is CyncRouter.ActionKind (uint8 in the ABI), see actionKind() in lib/action.ts
export const routerAbi = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'kind', type: 'uint8' },
      { name: 'to', type: 'address' },
      { name: 'actionId', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'executeToken',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'kind', type: 'uint8' },
      { name: 'token', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'actionId', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'feeBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'allowedTokens',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;
