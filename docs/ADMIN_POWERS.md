# Administrative powers

- `DEFAULT_ADMIN_ROLE`: grants roles; intended for a reviewed Safe, never the deployer by default.
- `RISK_ADMIN_ROLE`: changes bounded token configuration, global caps, terms and unpauses after review;
  assigned to the timelock by the deployment script.
- `PAUSE_GUARDIAN_ROLE`: can only stop new risk.
- `ADAPTER_ADMIN_ROLE`: allowlists typed adapters; assigned to the timelock.
- `FEE_MANAGER_ROLE`: releases only explicitly attributed treasury fees; assigned to the timelock.
- Vault/receipt/epoch manager wiring is one-time.

No admin function sweeps senior cash, position reserves or junior capital. Mainnet role
addresses are intentionally unset. Base Sepolia uses a one-day OpenZeppelin
`TimelockController`, with a separately configured proposer and permissionless execution.
The initial mock adapter is allowlisted during construction and its mutable test price is
controlled by the timelock, so later changes cannot bypass the delay. A production deployment
still needs the final Safe and role-separation review.

The admin console never sends risk or adapter calls directly from a proposer wallet. It
encodes a bounded action, simulates the target call with the timelock as caller, derives the
operation ID from target/data/predecessor/salt, verifies `PROPOSER_ROLE`, then simulates the
OpenZeppelin `schedule` call with the configured minimum delay. Execution remains a distinct
permissionless action after the delay and is not automated by the web application.
