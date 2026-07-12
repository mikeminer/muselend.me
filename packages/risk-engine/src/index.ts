export const BPS = 10_000n;
export const RAY = 10n ** 27n;
export const YEAR_SECONDS = 365n * 24n * 60n * 60n;

export function mulDivDown(x: bigint, y: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError("denominator must be positive");
  if (x < 0n || y < 0n) throw new RangeError("unsigned values required");
  return (x * y) / denominator;
}

export function mulDivUp(x: bigint, y: bigint, denominator: bigint): bigint {
  const floor = mulDivDown(x, y, denominator);
  return (x * y) % denominator === 0n ? floor : floor + 1n;
}

export type PositionTerms = {
  saleProceeds: bigint;
  advanceRateBps: bigint;
  seniorCoverageBps: bigint;
  coverageCapBps: bigint;
};

export function positionLimits(terms: PositionTerms) {
  if (terms.coverageCapBps < BPS) throw new RangeError("coverage cap must cover sale reserve");
  const coverageCap = mulDivDown(terms.saleProceeds, terms.coverageCapBps, BPS);
  return {
    maxPrincipal: mulDivDown(terms.saleProceeds, terms.advanceRateBps, BPS),
    maxWorstCaseDebt: mulDivDown(terms.saleProceeds, terms.seniorCoverageBps, BPS),
    coverageCap,
    juniorCoverage: coverageCap - terms.saleProceeds,
  };
}

export type KinkRateConfig = { baseRateRay: bigint; preKinkSlopeRay: bigint; postKinkSlopeRay: bigint; kinkRay: bigint; maxRateRay: bigint };
export function utilizationRay(cash: bigint, borrows: bigint): bigint {
  const total = cash + borrows;
  return total === 0n ? 0n : mulDivDown(borrows, RAY, total);
}
export function borrowRateRay(utilization: bigint, c: KinkRateConfig): bigint {
  if (c.kinkRay <= 0n || c.kinkRay >= RAY) throw new RangeError("invalid kink");
  const rate = utilization <= c.kinkRay
    ? c.baseRateRay + mulDivUp(c.preKinkSlopeRay, utilization, c.kinkRay)
    : c.baseRateRay + c.preKinkSlopeRay + mulDivUp(c.postKinkSlopeRay, utilization - c.kinkRay, RAY - c.kinkRay);
  return rate > c.maxRateRay ? c.maxRateRay : rate;
}
export function accrueIndex(indexRay: bigint, annualRateRay: bigint, elapsedSeconds: bigint): bigint {
  return indexRay + mulDivUp(mulDivUp(indexRay, annualRateRay, RAY), elapsedSeconds, YEAR_SECONDS);
}
export function debtSharesForPrincipal(principal: bigint, indexRay: bigint): bigint { return mulDivUp(principal, RAY, indexRay); }
export function debtFromShares(shares: bigint, indexRay: bigint): bigint { return mulDivUp(shares, indexRay, RAY); }
export function worstCaseDebt(principal: bigint, maxAprRay: bigint, durationSeconds: bigint, fixedDebtFees = 0n): bigint {
  return principal + mulDivUp(mulDivUp(principal, maxAprRay, RAY), durationSeconds, YEAR_SECONDS) + fixedDebtFees;
}

export function settlementScenario(saleReserve: bigint, coverageCap: bigint, priceMultipleBps: bigint) {
  if (coverageCap < saleReserve) throw new RangeError("cap below reserve");
  const buybackCost = mulDivUp(saleReserve, priceMultipleBps, BPS);
  const spend = buybackCost < coverageCap ? buybackCost : coverageCap;
  return { buybackCost, fullRedemption: buybackCost <= coverageCap,
    tokensReturnedBps: buybackCost === 0n ? BPS : mulDivDown(spend, BPS, buybackCost),
    juniorSpent: spend > saleReserve ? spend - saleReserve : 0n,
    juniorPnl: spend < saleReserve ? saleReserve - spend : 0n,
    topUpForFull: buybackCost > coverageCap ? buybackCost - coverageCap : 0n };
}
