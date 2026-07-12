# Operations runbook

## API rate limiting

Production API requests use an atomic Redis `INCR`/`PEXPIRE` window keyed by route and a
SHA-256 digest of the forwarded client address. Redis is initialized lazily. If configured
Redis becomes unavailable in production, API handlers fail closed with `429`; development
uses a bounded in-memory fallback so local work does not require managed infrastructure.
Monitor Redis availability and `429` rate before changing limits. Never disable the limiter
to mitigate an outage.

## Incident sequence

1. Confirm chain, release commit, verified addresses and current pause/role state.
2. For anomalies, pause new openings/deposits; never block repay, settlement or available withdrawals.
3. Compare on-chain balances, aggregate reserves, principal, debt shares and epoch locks.
4. Preserve RPC responses, transaction hashes and logs without user PII or secrets.
5. Follow `INCIDENT_RESPONSE.md`; adapter additions require the configured delay.
6. Resume only after root cause, invariant replay, review and public status update.

## Website maintenance mode

Set `MAINTENANCE_MODE=true` only as an environment-scoped deployment change. Product pages
rewrite to `/maintenance`, transactional APIs rewrite to an explicit `503` response, and
`/api/health`, status, risk, documentation and legal pages remain reachable. This switch does
not pause contracts and must never be described as protecting on-chain funds. Use the on-chain
pause guardian separately when new protocol risk must stop.

Legal-decision feature flags (`GEOFENCING_ENABLED`, `ALLOWLIST_ENABLED`,
`KYC_ADAPTER_ENABLED`, `JURISDICTION_RESTRICTIONS_ENABLED`, and
`MAX_RETAIL_EXPOSURE_ENABLED`) default to `false` and must remain disabled until the matching
legal and product decision is documented.
