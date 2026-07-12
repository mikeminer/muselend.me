# Operations runbook

## API rate limiting

Production API requests use an atomic Redis `INCR`/`PEXPIRE` window keyed by route and a
SHA-256 digest of the forwarded client address. Redis is initialized lazily. If configured
Redis becomes unavailable in production, API handlers fail closed with `429`; development
uses a bounded in-memory fallback so local work does not require managed infrastructure.
Monitor Redis availability and `429` rate before changing limits. Never disable the limiter
to mitigate an outage.

## Optional database persistence

Chain reads and verified quote calculations remain available when `DATABASE_URL` is absent or
temporarily unavailable. Token metadata caches and sanitized quote telemetry use a one-second
best-effort write deadline and never contain wallet, IP, cookie, signature or arbitrary calldata.
Legal and risk acceptances are different: those endpoints return `PERSISTENCE_UNAVAILABLE`
unless the signed record is durably stored. Apply Drizzle migrations before enabling readiness;
analytics aggregates are derived/non-authoritative and must always retain a source block.

## Runtime observability

Route handlers emit newline-delimited JSON events suitable for Vercel Runtime Logs. The
baseline fields are `service`, timestamp, level, event, request ID, route, status, duration
and rate-limit backend. Logs intentionally exclude wallet addresses, client IP values,
signatures, cookies, request bodies and RPC credentials. Redis and SIWE nonce operations use
short deadlines, database writes use a five-second deadline, and read-only RPC calls use an
eight-second deadline.

`/api/health` is a liveness endpoint and remains HTTP 200 while reporting separate readiness
booleans for contracts, database, Redis and Vercel. `readyForTransactions=false` must block
production promotion even when liveness is healthy. After deployment, inspect Runtime Logs
for `api.error`, verify no secrets/PII appear, and configure alerting or a drain only after its
plan and cost are approved.

## Incident sequence

1. Confirm chain, release commit, verified addresses and current pause/role state.
2. For anomalies, pause new openings/deposits; never block repay, settlement or available withdrawals.
3. Compare on-chain balances, aggregate reserves, principal, debt shares and epoch locks.
4. Preserve RPC responses, transaction hashes and logs without user PII or secrets.
5. Follow `INCIDENT_RESPONSE.md`; adapter additions require the configured delay.
6. Resume only after root cause, invariant replay, review and public status update.

## Timelock proposal procedure

1. Connect only the configured proposer wallet or Safe interface on Base Sepolia.
2. Compare current caps, token risk tier, adapter status and timelock roles shown by direct reads.
3. Select a typed action and use a unique human-auditable proposal label; never paste arbitrary calldata.
4. Require `Direct simulation: passed`, the expected target, and the expected operation ID.
5. Schedule the operation and record its BaseScan transaction. Scheduling does not execute it.
6. After the minimum delay, independently review calldata and operation ID before permissionless execution.
7. For emergency pause, use the separate guardian path; unpause remains timelocked.

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
