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

### Base Creator Token mirror

The testnet claim factory is deployed separately with
`script/DeployBaseSepoliaMirror.s.sol`. Its immutable attester must be a dedicated zero-funded
signing account, different from the funded deployer and governance roles. The corresponding
private key is server-only in `TESTNET_CLAIM_ATTESTER_PRIVATE_KEY`; it must never use a
`NEXT_PUBLIC_` name, appear in a manifest, or be passed on a command line. Before broadcast:

1. run the full factory tests and a non-broadcast script simulation on chain `84532`;
2. confirm `TESTNET_CLAIM_ATTESTER` is the address derived from the server secret;
3. deploy and verify the factory, then publish only `NEXT_PUBLIC_CREATOR_MIRROR_FACTORY_ADDRESS`;
4. call `attester()`, `SOURCE_CHAIN_ID()` and `DESTINATION_CHAIN_ID()` on the deployed bytecode;
5. exercise the API's invalid-input and fail-closed paths before enabling claims.

The API reads source metadata, `balanceOf(wallet)`, `coinType()`, `contractVersion()` and
`getPoolKey()` at one Base block. It accepts only coin type zero whose pool contains the source
token and uses the current hook returned by the canonical Zora factory. Signed vouchers expire
after ten minutes. The factory enforces one claim per wallet/source-token pair and a safety cap
of 1,000,000 whole tokens. A mirror token is a faucet asset, not a bridge or a governance-enabled
collateral market.

`BASE_MAINNET_RPC_URL` should be a production provider endpoint. The public Base RPC is
explicitly rate-limited, so testnet operation also configures
`BASE_MAINNET_FALLBACK_RPC_URL`; the Viem fallback transport retries a failed read on the
secondary endpoint. Unexpected provider errors are normalized to `CLAIM_UNAVAILABLE` and never
returned verbatim to the browser.

## Base Sepolia deployment record

On 2026-07-13, commit `ded4bdd` passed CI and was deployed to Base Sepolia from the dedicated
encrypted testnet signer. Foundry broadcast 33 transactions; all 33 receipts succeeded. The
manifest was written at block `44,078,371`. The signer nonce advanced from `0` to `33` and its
balance changed from `0.1 ETH` to `0.099881067745602951 ETH`, a deployment cost of
`0.000118932254397049 ETH`, below the pre-approved prudential cap of `0.000332051789 ETH`.

All 11 deployed contracts have non-empty on-chain bytecode and exact-match source verification
on Sourcify. Read-only post-deployment checks confirmed canonical USDC decimals, the one-day
timelock, role handoff, separately held pause-guardian role, revoked deployer default-admin roles,
manager wiring, adapter allowlisting, creator-token validation and `mainnetEnabled == false`.
The public addresses and transaction hashes are recorded in the repository deployment manifests.

### Creator Token mirror deployment record

On 2026-07-13, the isolated `BaseCreatorTokenMirrorFactory` was deployed at Base Sepolia
block `44,082,475` from commit `a8b7b3e`. Transaction
`0xf0bd176f5054472acdac237e33873eea06335b93878c0ff3ac439564ef20eb32` succeeded and
created factory `0x048a7F340962f45B676440B66C0806347867575E`. The transaction used
`0.000013923606830767 ETH`; the funded deployer retained `0.099867144138772184 ETH`.

Post-deployment calls confirmed source chain `8453`, destination chain `84532`, native Base
Sepolia USDC, the configured Sepolia V4 hook and attester
`0x9324018e1F22b69612d2B783b8Bb108bfE0aCEAA`. Runtime bytecode is 9,700 bytes and the
factory has exact-match Sourcify verification. The sensitive signing key exists only as the
write-only Vercel production variable `TESTNET_CLAIM_ATTESTER_PRIVATE_KEY`.

## Vercel deployment record

On 2026-07-13, commit `03967a4` passed both CI jobs and was promoted to the guarded Vercel
production deployment at `https://muselend.vercel.app`. The runtime uses the verified Base
Sepolia manifest, keeps both mainnet flags disabled and reports contract and Vercel readiness.
Read-only health, pool-snapshot and direct-chain product paths were exercised after promotion.

`readyForTransactions` intentionally remains `false` until a production database, Redis and
WalletConnect project are provisioned and verified. The custom `muselend.me` domain is not yet
attached: registrar or DNS changes remain an explicit owner gate.
