export const routerAbi = [
  {
    type: 'function',
    name: 'tip',
    stateMutability: 'payable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'actionId', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;
