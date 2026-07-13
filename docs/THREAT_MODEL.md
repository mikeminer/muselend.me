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

## Base-to-Sepolia mirror claims

The claim service introduces attester compromise, forged metadata, stale balance, replay and
lookalike-token risks. Controls are server-side canonical Zora interface/hook checks, same-block
metadata and balance reads, EIP-712 domain separation bound to chain `84532` and the deployed
factory, ten-minute voucher expiry, `msg.sender`/wallet equality, per-wallet/per-source replay
protection, metadata immutability per source token and a whole-token mint cap. The dedicated
attester holds no funds. Its compromise could authorize false testnet balances until the feature
is disabled and a new immutable factory is deployed; it cannot move Base assets or protocol
reserves. Mirror tokens are explicitly disclosed as valueless test assets and are not registered
as collateral automatically.
