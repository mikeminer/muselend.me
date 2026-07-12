# Threat model

Protected assets are isolated sale reserves, senior cash/receivables and junior epoch
capital. Primary threats include reentrancy, arbitrary calls, malicious tokens/adapters,
fee-on-transfer behavior, route substitution, price impact, rounding insolvency,
cross-position reserve reuse, stale quotes, default griefing, governance compromise,
withdrawal runs, indexer reorgs and frontend transaction deception.

Current controls include typed adapters, balance-delta accounting, exact-transfer checks,
safe transfers, reentrancy guards, hard risk caps, non-transferable receipts/shares,
one-position settlement, senior-first default, bounded keeper bounty, per-call queue
processing and stateful invariants. Remaining critical work is listed in launch gates:
external audit, economic review, production adapter validation, timelock deployment,
monitoring and legal review.
