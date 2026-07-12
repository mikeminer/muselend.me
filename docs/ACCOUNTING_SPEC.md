# MuseLend V1 accounting specification

> Status: implemented for the Base Sepolia candidate. Testnet parameters are illustrative
> and are not a mainnet risk endorsement.

## 1. Units and rounding

- USDC amounts use the asset's native 6 decimals.
- Creator-token amounts use each token's declared decimals and are stored as raw units.
- Rates and debt indices use RAY precision (`1e27`); configuration ratios use basis
  points (`1e4`).
- Asset amounts owed by a user or reserved for solvency round up. Assets paid out or
  shares credited to a user round down.
- Full-precision multiplication/division uses `Math.mulDiv`; no intermediate
  multiplication may rely on unchecked truncation.

## 2. Position values

For a position:

- `q`: creator-token units received and sold.
- `S`: net USDC sale proceeds measured strictly as the position manager's balance delta.
- `L`: senior principal.
- `D(t)`: current senior debt.
- `T`: permitted term.
- `K`: maximum synthetic buyback coverage.
- `H`: junior coverage locked for the position.
- `P`: hedge premium allocated to the relevant junior epoch.

Given `coverageCapBps >= 10_000`:

```text
K = floor(S * coverageCapBps / 10_000)
H = K - S
L <= floor(S * advanceRateBps / 10_000)
worstCaseDebtAtMaturity <= floor(S * seniorCoverageBps / 10_000)
```

The implementation rejects configurations where `K < S`, arithmetic exceeds type
bounds, or the selected epoch cannot lock `H` through maturity plus grace.

## 3. Atomic opening

Opening succeeds only as one transaction. The manager receives exactly `q`, rejects
fee-on-transfer or rebasing behavior, executes a typed adapter sale, and derives `S`
from the USDC balance delta. The adapter must send proceeds to the manager/position
escrow. No principal may be originated before that delta exists and passes minimum,
slippage, exposure, senior liquidity, and junior coverage checks.

`S` is then attributed to exactly one `positionId`; it is never senior-vault cash and
cannot fund another loan. The epoch locks `H`, the senior vault originates `L`, and the
borrower receives:

```text
netBorrowerProceeds = L - originationFee - hedgePremium - protocolFee
```

Every deduction is computed separately, stored or emitted, and paid only after successful
origination. The origination fee is `ceil(L * originationFeeBps / 10_000)`, is capped at
2% on-chain, does not become debt, and is transferred directly to `ProtocolTreasury`.
A negative result reverts.

## 4. Interest index

Utilization is:

```text
U = totalBorrows / (availableCash + totalBorrows)
```

When the denominator is zero, utilization is zero. The annual borrow rate is a
continuous piecewise-linear kink curve capped by `maxBorrowApr`:

```text
if U <= kink:
  rate = baseRate + preKinkSlope * U / kink
else:
  rate = baseRate + preKinkSlope
       + postKinkSlope * (U - kink) / (1 - kink)
```

The vault accrues a global borrow index from elapsed seconds. Position debt shares are
minted by dividing principal by the current index with rounding up. Current debt is
`ceil(debtShares * borrowIndex / RAY)`. Repayment burns shares conservatively so partial
repayment cannot forgive residual debt through rounding.

The initial solvency check computes worst-case debt using the contractual maximum APR,
the full term, grace period, origination amounts that become debt (if any), and upward
rounding. Runtime collectible senior debt is capped at the amount covered by the
position's senior reserve invariant; value beyond that cap is never represented as a
senior-vault receivable.

Accrued interest is tracked separately from cash. ERC-4626 `totalAssets` must not treat
uncollectible or merely projected interest as freely withdrawable liquidity. Withdraw
and redeem limits are based on actual available cash after protected obligations.

At repayment, the configured reserve factor applies only to realized interest:

```text
protocolInterestFee = floor(realizedInterest * reserveFactorBps / 10_000)
lenderInterest = realizedInterest - protocolInterestFee
```

The protocol portion is transferred to `ProtocolTreasury` in the same transaction and
therefore never appears in lender `totalAssets`. Principal is never subject to the fee.

## 5. Settlement waterfall

### Repayment and full physical redemption

The owner first pays `D(t)`. A typed exact-output swap attempts to purchase exactly `q`.
The protocol may spend at most `K + maxTopUp`, where user top-up is explicit and bounded.
Reserve `S` is spent first, then at most `H` from the junior epoch, then user top-up.
Unused `H` is released. If buyback costs less than `S`, `S - cost` is junior realized
PnL. Only after accounting and token delivery is the receipt burned.

### Capped settlement

The protocol executes exact-input using no more than `K`, returns the actual creator
tokens received (which may be less than `q`), releases unused coverage, and closes the
receipt. No cash payout is derived from a spot oracle.

### Expiry/default

After maturity plus grace, permissionless settlement pays in this order:

1. bounded keeper bounty;
2. senior debt from `S`, with senior priority;
3. explicitly capped protocol fees, if permitted by the senior invariant;
4. residual `S - seniorPayment - bounty - fees` to the junior epoch.

The synthetic right is cancelled, `H` is released, and the position becomes terminal.
Terminal-state checks prevent double settlement.

## 6. Junior epoch NAV

For each epoch, accounting is isolated:

```text
availableCapital = depositedCapital + realizedPnl + premium - redeemedCapital - lockedCoverage
epochNav = availableCapital + lockedCoverage
```

`lockedCoverage` is a liability allocation, not spendable cash. Deposits close before
exposure starts. Redemptions begin only after the epoch is closed and every associated
position is terminal. Shares are epoch-specific and redemption rounds assets down.
Losses from buybacks reduce NAV; premium and creator-token downside PnL increase NAV.

## 7. Required executable properties

The Solidity and TypeScript models must share deterministic vectors for rate, index,
shares, worst-case debt, caps, premiums, and epoch NAV. Fuzz and invariant handlers must
prove reserve isolation, senior priority, bounded junior locks, single settlement,
non-transferability, pause-safe exits, and the absence of pre-sale borrowing.
