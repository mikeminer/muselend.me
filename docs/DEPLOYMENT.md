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
