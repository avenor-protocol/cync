# Cync

Shareable onchain actions on Sonic. Demo version, testnet only.

- `/create` - create a tip link
- `/a` - action page (connect wallet, tip)
- `/api/actions/tip` - action api (`GET` metadata, `POST` unsigned tx)
- `contracts/CyncRouter.sol` - router contract with platform fee

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

You need MetaMask or Rabby with some testnet S. On mobile, set `NEXT_PUBLIC_WC_PROJECT_ID` to connect with WalletConnect.

## Env

- `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_EXPLORER_URL` - override testnet defaults
- `NEXT_PUBLIC_ROUTER_ADDRESS` - deployed router (empty = direct transfer, no fee)
- `NEXT_PUBLIC_SAMPLE_RECIPIENT` - recipient for the example link on the home page
- `NEXT_PUBLIC_WC_PROJECT_ID` - WalletConnect project id from cloud.reown.com (empty = browser wallets only)

## Contract

Deploy `CyncRouter.sol` with Remix (solc 0.8.24) on Sonic testnet:

- `_feeRecipient` - fee wallet
- `_feeBps` - fee in bps, max 100 (1%)

Then set `NEXT_PUBLIC_ROUTER_ADDRESS` and rebuild.

## TODO

- USDC tips
- action registry / verified actions
- tests for the router
