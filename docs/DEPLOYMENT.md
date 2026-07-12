# Deployment

Local tests use mocks. Base Sepolia deployment order is governance timelock, mock token
and adapter, rate model, risk manager, senior vault, hedge epoch vault, receipt, position
manager, treasury, validator configuration and one-time manager wiring. The risk,
adapter and fee-manager roles point to the timelock; the pause guardian remains immediate.
Scripts must verify chain ID `84532`, USDC bytecode/decimals, roles and
`mainnetEnabled == false`, then write `deployments/base-sepolia.json`.

No private key belongs in Vercel. A testnet deployment requires a dedicated funded
testnet signer supplied through a secure local keystore or hardware-wallet flow. Source
verification and smoke transactions are mandatory before frontend addresses are set.
