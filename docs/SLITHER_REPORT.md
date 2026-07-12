# Slither security review

Last reviewed: 2026-07-12

Tooling: Slither `0.11.5`, Foundry `1.7.1`, Solidity `0.8.35`.

Command:

```sh
slither . --foundry-out-directory out --filter-paths "lib" --fail-high
```

## Result

- High: 0
- Medium: 0
- Low: 9
- Informational: 1

The remaining low-severity findings are timestamp comparisons that implement explicit deadlines,
maturities, grace periods, and hedge epochs. Block producers can influence timestamps only within a
small range; no check relies on exact-second equality and all economic windows are materially longer.

The informational finding is cyclomatic complexity in `openPosition`. That function intentionally
performs the complete atomic origination sequence; its behavior is covered by unit, integration, and
invariant tests.

## Reviewed suppressions

Slither's balance-based reentrancy detector reports the adapter balance-delta checks as stale reads.
Those checks are intentional defenses against a dishonest adapter return value. Suppressions are
scoped to the four affected entrypoints, with these compensating controls:

- every mutating entrypoint is protected by OpenZeppelin `ReentrancyGuard`;
- close and default paths transition the position to `Settling` before settlement calls;
- the swap adapter is allowlisted and has a typed, narrow interface;
- adapter outputs must match independently observed ERC-20 balance deltas;
- debt shares are cleared before the external repayment transfer.

The zero-equality suppression in `previewBorrowIndex` is also local: zero elapsed time and zero debt
shares are exact accounting boundaries, not attacker-controlled equality assumptions.

CI runs Slither on every change and rejects any new high-impact finding. Dependency code under `lib`
is excluded from this scan and remains governed by pinned OpenZeppelin versions and dependency audit.
