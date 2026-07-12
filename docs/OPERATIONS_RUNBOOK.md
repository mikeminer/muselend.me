# Operations runbook

1. Confirm chain, release commit, verified addresses and current pause/role state.
2. For anomalies, pause new openings/deposits; never block repay, settlement or available withdrawals.
3. Compare on-chain balances, aggregate reserves, principal, debt shares and epoch locks.
4. Preserve RPC responses, transaction hashes and logs without user PII or secrets.
5. Follow `INCIDENT_RESPONSE.md`; adapter additions require the configured delay.
6. Resume only after root cause, invariant replay, review and public status update.
