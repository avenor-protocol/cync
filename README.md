# Cync

Shareable onchain actions on Sonic. Demo version, testnet only.

- `/create` - create a transfer, tip, or donate link
- `/a` - action page (connect wallet, review, sign); shared links get a preview card on X, Telegram, and Discord from `/api/og`
- `/faucet` - test USSD / USDC (testnet only)
- `/terms`, `/privacy` - legal pages (contact address in `lib/site.ts`)
- `/api/actions/{transfer|tip|donate}` - action api (`GET` metadata, `POST` unsigned tx)
- `contracts/CyncRouter.sol` - router contract with platform fee

Action types: **tip** and **donate** let the payer pick a suggested or custom amount; **transfer** has one fixed amount set by the creator (the API ignores any other amount). Links without `type` are tips; links without `token` pay in S.

The action page does not trust the API's transactions. `lib/verify.ts` rebuilds what the link describes (router address, kind, recipient, token, amount, actionId) and blocks anything else, including approvals that are unlimited or for another spender. Each transaction is then simulated before the wallet is asked to sign. The page also refuses API metadata that disagrees with the link, and shows the full recipient address, what the recipient gets, and the fee. Links are marked "Unverified" until the Action Registry exists.

Creators can sign a link (`lib/signature.ts`, EIP-712 over type, recipient, token address, title, description, icon, and amounts; `creator` and `sig` go in the link). The action page and the API both check the signature, contract wallets included (ERC-1271), and refuse a signed link whose fields were edited. Payers see "Signed by 0x…" or "Creator not signed".

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

You need MetaMask or Rabby with some testnet S (faucet: https://testnet.soniclabs.com/account). On mobile, set `NEXT_PUBLIC_WC_PROJECT_ID` to connect with WalletConnect.

## Env

- `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_EXPLORER_URL` - override testnet defaults (14601, rpc.testnet.soniclabs.com, testnet.sonicscan.org)
- `NEXT_PUBLIC_ROUTER_ADDRESS` - deployed router (empty = direct transfer, no fee)
- `NEXT_PUBLIC_SAMPLE_RECIPIENT` - recipient for the example link on the home page
- `NEXT_PUBLIC_USSD_ADDRESS`, `NEXT_PUBLIC_USDC_ADDRESS` - ERC-20s to offer (empty = native S only). USSD is the default when set. The API checks each token's decimals onchain (USSD 18, USDC 6) and that the router allows it
- `NEXT_PUBLIC_TEST_TOKENS` - `1` when the tokens above are testnet `TestToken`s: enables the `/faucet` page and points payers who are short on funds to it
- `NEXT_PUBLIC_WC_PROJECT_ID` - WalletConnect project id from cloud.reown.com (empty = browser wallets only)
- `NEXT_PUBLIC_SITE_URL` - public URL for link-preview images (empty = the Vercel deployment URL)

## Deploy (own server)

Docker runs the app; Caddy in front of it serves HTTPS and renews the certificate itself. Any Debian/Ubuntu VPS works; a fresh one gets Docker (and a swap file under 2 GB RAM) on the first run.

1. Point the domain's DNS `A` record to the server IP.
2. `cp .env.example .env.production` and fill it in: `DOMAIN=example.io` and `NEXT_PUBLIC_SITE_URL=https://example.io`. The file is gitignored.
3. From your machine (Git Bash works on Windows):

```bash
sh deploy/push.sh root@SERVER_IP
```

This uploads the last commit (not uncommitted changes) and `.env.production` to `/opt/cync`, then runs `deploy/deploy.sh` there to build and start. Run it again to ship an update, or point it at a new server to move: the site is back once DNS points there.

### Mainnet next to testnet

Testnet keeps running from `.env.production`. To add Sonic mainnet:

1. Deploy the router from a wallet used only as owner, with a different fee wallet. `FEE_BPS` has no default.

```bash
FEE_RECIPIENT=0x... FEE_BPS=100 forge script script/DeployMainnet.s.sol --rpc-url sonic --broadcast --interactive
```

2. `cp .env.mainnet.example .env.mainnet` and set `NEXT_PUBLIC_ROUTER_ADDRESS` and `NEXT_PUBLIC_WC_PROJECT_ID`.
3. Run `sh deploy/push.sh root@SERVER_IP`. With `.env.mainnet` present, it builds both apps and serves mainnet on `MAINNET_DOMAIN` through `deploy/Caddyfile.mainnet`, which replaces the old-address redirect.

## Contract

`script/DeployTestnet.s.sol` deploys the whole demo on Sonic testnet: `CyncRouter`, test USSD (18 decimals) and test USDC (6 decimals), both allowlisted. It refuses to run on any chain except 14601. The broadcasting wallet becomes the router owner and needs about 0.01 testnet S. Install forge-std first (see Tests). `--interactive` prompts for the private key, so it never lands in a file or the shell history.

```bash
FEE_RECIPIENT=0x... forge script script/DeployTestnet.s.sol \
  --rpc-url sonic_testnet --broadcast --interactive \
  --verify   # optional, needs ETHERSCAN_API_KEY
```

- `FEE_RECIPIENT` - fee wallet
- `FEE_BPS` - fee in bps, max 100 (1%), default 100

The script prints the `NEXT_PUBLIC_*` lines to paste into `.env.local` (or the host's env), then rebuild. The test tokens (`contracts/testnet/TestToken.sol`) have no value: anyone can mint 1,000 with `drip()`, from the `/faucet` page.

### Testnet deployment

| | Address |
|---|---|
| CyncRouter | [`0x3AD5A8CB52b40fdB25d0393704706f5D5Fc9913B`](https://testnet.sonicscan.org/address/0x3AD5A8CB52b40fdB25d0393704706f5D5Fc9913B) |
| USSD (test) | [`0xDE06feD223A4D789282eA8bC217F08226FEE94Aa`](https://testnet.sonicscan.org/address/0xDE06feD223A4D789282eA8bC217F08226FEE94Aa) |
| USDC (test) | [`0xf9572c19A0a2c86526D5feE17fcdEC67613c0f30`](https://testnet.sonicscan.org/address/0xf9572c19A0a2c86526D5feE17fcdEC67613c0f30) |

Fee: 1% (100 bps). Owner and fee wallet: `0x229864263B53A4631A9Ab04017D95B1a551a062b`.

This router predates two-step ownership; redeploy to get it (the app works with either version).

Ownership moves in two steps: the owner calls `transferOwnership(newOwner)`, then the new owner calls `acceptOwnership()`. Until then nothing changes, so a wrong address can be replaced, and `transferOwnership(address(0))` cancels.

Demo: https://testnet.cync.avenor-protocol.com

`execute(kind, to, actionId)` takes native S; `kind` is `0` Transfer, `1` Tip, `2` Donate, and any other value reverts. Every action emits `ActionExecuted(actionId, from, to, kind, token, amount, fee)` with `token = address(0)` for S.

### Token actions (USSD / USDC)

`executeToken(kind, token, to, amount, actionId)` pulls an allowlisted ERC-20 straight from the sender to the recipient and the fee wallet (the router never holds tokens). The sender must `approve` the router first: the API returns `[approve, executeToken]` when the allowance is short (approving exactly the amount) and `[executeToken]` otherwise, and the action page sends them in order. The owner manages the allowlist:

```
setTokenAllowed(<USSD address>, true)
setTokenAllowed(<USDC address>, true)
```

## Tests

Solidity dependencies live in `deps/` (gitignored; `lib/` is the app's TypeScript), so install forge-std there once:

```bash
forge install foundry-rs/forge-std@v1.9.7 --no-git
forge test -vv
```

## TODO

- action registry / verified actions
