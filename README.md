# MuseLend

MuseLend is a testnet-first protocol for realizing USDC liquidity from Zora Creator
Tokens on Base. Creator tokens are sold atomically at opening; the actual USDC balance
delta becomes an isolated position reserve. A senior ERC-4626 vault originates a loan,
while fixed junior epochs cover synthetic buyback exposure only up to an explicit cap.

The product does **not** promise guaranteed yield, capital protection, or unlimited 1:1
redemption. Base Mainnet is disabled.

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

The UI and local mock protocol are functional. No MuseLend contract address has been
deployed to Base Sepolia, and no Vercel or database resource has been provisioned. Those
steps require owner account access and a funded testnet signer. See `PLAN.md` and
`docs/LAUNCH_GATES.md`.
