# Administrative powers

- `DEFAULT_ADMIN_ROLE`: grants roles; intended for a reviewed Safe, never the deployer by default.
- `RISK_ADMIN_ROLE`: changes bounded token configuration, terms and unpauses after review.
- `PAUSE_GUARDIAN_ROLE`: can only stop new risk.
- `ADAPTER_ADMIN_ROLE`: allowlists typed adapters; intended behind a timelock.
- Vault/receipt/epoch manager wiring is one-time.

No admin function sweeps senior cash, position reserves or junior capital. Mainnet role
addresses are intentionally unset. A production deployment needs a Safe, timelock and
role-separation review.
