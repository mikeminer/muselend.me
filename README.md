# MuseLend

MuseLend is a testnet-first protocol for realizing USDC liquidity from Zora Creator
Tokens on Base. Creator tokens are sold atomically at opening; the actual USDC balance
delta becomes an isolated position reserve. A senior ERC-4626 vault originates a loan,
while fixed junior epochs cover synthetic buyback exposure only up to an explicit cap.

The product does **not** promise guaranteed yield, capital protection, or unlimited 1:1
redemption. Base Mainnet is disabled.

The Base Sepolia app also includes a testnet-only Creator Token claim. A server attests the
connected wallet's canonical Creator Coin balance on Base, and a factory mints a distinct
one-time ERC-20 mirror with the exact source name, symbol and decimals. This is not a bridge,
does not make the test token redeemable on Base, and does not automatically enable it as
MuseLend collateral.

## Workspace

- `apps/web` — Next.js App Router product and public documentation.
- `packages/contracts` — non-upgradeable Solidity core and Foundry tests.
- `packages/risk-engine` — differential TypeScript accounting model.
- `packages/config`, `packages/abis`, `packages/indexer`, `packages/ui` — shared packages.

## Local verification

Requirements: Node.js 20.18.1+, pnpm 10.25.0, Foundry 1.7.1.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cd packages/contracts
forge fmt --check
forge test
```

Copy `.env.example` to an untracked `.env.local` only when runtime integration is needed.
Never provide a seed phrase or commit a private key.

## Current network state

The guarded MuseLend testnet stack is deployed at Base Sepolia block `44,078,371` from
commit `ded4bdd`. All 11 contracts have exact-match source verification on Sourcify,
governance is handed to the one-day timelock, the separate pause guardian is active, and
mainnet remains disabled. Public addresses are recorded in
`packages/contracts/deployments/base-sepolia.json` and `deployments/base-sepolia.json`.

The isolated Creator Token mirror factory is deployed separately at
`0x9e1Dbdebd28F104fF1D534055597dF03A92a4199` (block `44,089,217`) and has exact-match
Sourcify verification. Its public deployment record is stored in
`packages/contracts/deployments/base-sepolia-mirror.json` and
`deployments/base-sepolia-mirror.json`.

The production web build is live at `https://muselend.vercel.app` with the verified
Base Sepolia addresses. Its read-only health and pool endpoints are operational; transaction
readiness remains fail-closed until persistence, Redis and WalletConnect are provisioned.
Connecting `muselend.me`, external services and any mainnet/legal activation remain explicit
owner gates. See `PLAN.md`, `docs/DEPLOYMENT.md`, and `docs/LAUNCH_GATES.md`.

## License

MuseLend's original source code is licensed under the GNU Affero General Public License,
version 3 only (`AGPL-3.0-only`). See [`LICENSE`](LICENSE). Third-party dependencies and
vendored libraries retain their own license terms.
