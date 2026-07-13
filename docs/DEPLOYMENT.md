# Deployment

Local tests use mocks. Base Sepolia deployment order is governance timelock, mock token
and adapter, rate model, risk manager, senior vault, hedge epoch vault, receipt, position
manager, treasury, validator configuration and one-time manager wiring. The risk,
adapter and fee-manager roles point to the timelock; the pause guardian remains immediate.
Scripts must verify chain ID `84532`, USDC bytecode/decimals, roles and
`mainnetEnabled == false`, then write `deployments/base-sepolia.json`.

The deployer hands default administration and all non-emergency operational roles to the
one-day timelock after one-time wiring. Only the separately configured pause guardian
remains immediate. The generated manifest contains public addresses, chain ID and the
deployment block; it contains no key material. Set `WRITE_DEPLOYMENT_MANIFEST=false` only
for isolated script tests.

No private key belongs in Vercel. A testnet deployment requires a dedicated funded
testnet signer supplied through a secure local keystore or hardware-wallet flow. Source
verification and smoke transactions are mandatory before frontend addresses are set.

Before either operator sequence, load the intended environment locally and run the
non-mutating configuration preflight. It reports variable names and validation outcomes only;
it never prints their values:

```powershell
node --env-file=.env.testnet scripts/readiness.mjs --target=base-sepolia
node --env-file=.env.production scripts/readiness.mjs --target=vercel-production
```

A passing preflight confirms configuration shape, not contract correctness, account ownership,
funding, source verification or authorization to broadcast/deploy.

## Base Sepolia operator sequence

Import a dedicated testnet key into Foundry's encrypted keystore using the hidden prompts;
never put the key or keystore password in shell history or an environment file:

```powershell
cast wallet import muselend-testnet --interactive
```

Set only public role addresses and the read-only RPC URL in the current shell. Confirm that
`TESTNET_ADMIN` is the address stored in `muselend-testnet`. First run a simulation without
`--broadcast`; record its gas estimate and inspect every created contract and role transition:

```powershell
forge script script/DeployBaseSepolia.s.sol:DeployBaseSepolia `
  --rpc-url $env:BASE_SEPOLIA_RPC_URL `
  --account muselend-testnet `
  --sender $env:TESTNET_ADMIN `
  -vvvv
```

Broadcast is a separate, explicit owner gate. Only after the simulation, funding ceiling and
role addresses are approved, repeat the same command with `--broadcast`. Add `--verify` only
when the selected Base explorer API credential is configured. Do not use `--unlocked`, a raw
`--private-key`, or a password on the command line.

After confirmation, compare `broadcast/DeployBaseSepolia.s.sol/84532/run-latest.json` with
`deployments/base-sepolia.json`, verify source and bytecode, exercise read-only health checks,
and only then copy the manifest addresses into Vercel environment variables.

Set `NEXT_PUBLIC_DEPLOYMENT_BLOCK` from the generated manifest and create a unique, random
`INDEXER_SYNC_SECRET` of at least 32 characters. Apply the database schema before enabling
the authenticated `/api/indexer/sync` scheduler. The indexer deliberately trails the chain
by five confirmations and verifies stored block hashes, so a provider inconsistency or
short reorg is replayed rather than silently incorporated into product state.

Set `NEXT_PUBLIC_SWAP_ADAPTER_ADDRESS` only to the adapter address contained in the verified
manifest. On Base Sepolia the buy quote endpoints recognize the deterministic test adapter:
they verify its bytecode, PositionManager allowlist status, CreatorTokenValidator result and
on-chain test price before returning a typed route. They never return calldata. This mechanism
is testnet-only and must not be presented as Uniswap market execution or reused for mainnet.
Publish `NEXT_PUBLIC_INTEREST_RATE_MODEL_ADDRESS` from the same manifest so the borrower UI
derives indicative and maximum-rate debt figures from deployed contracts rather than constants.

## Latest read-only Base Sepolia simulation

On 2026-07-13, commit `61433c3` was simulated against the public Base Sepolia RPC with
`WRITE_DEPLOYMENT_MANIFEST=false` and temporary nonzero role addresses. The script completed
on chain ID `84532`, verified canonical USDC bytecode/decimals, executed every deployment and
governance handoff, and passed its post-deployment invariants. Foundry estimated `23,059,136`
gas and `0.000253650496 ETH` at the then-reported `0.011 gwei` gas price.

This is reproducibility evidence, not a funding request or broadcast approval. Dry-run contract
addresses are intentionally not published because they do not exist on-chain. Gas price and total
cost must be recomputed immediately before any separately approved testnet broadcast.
