import { describe, expect, it } from "vitest";
import { BPS, RAY, YEAR_SECONDS, accrueIndex, borrowRateRay, debtFromShares, debtSharesForPrincipal, positionLimits, settlementScenario, utilizationRay, worstCaseDebt } from "./index";
const pct=(n:number)=>BigInt(n)*RAY/100n;
describe("risk accounting",()=>{
  it("derives caps only from realized proceeds",()=>expect(positionLimits({saleProceeds:8_400_000_000n,advanceRateBps:6_000n,seniorCoverageBps:9_000n,coverageCapBps:15_000n})).toEqual({maxPrincipal:5_040_000_000n,maxWorstCaseDebt:7_560_000_000n,coverageCap:12_600_000_000n,juniorCoverage:4_200_000_000n}));
  it("rejects caps below the isolated reserve",()=>expect(()=>positionLimits({saleProceeds:1n,advanceRateBps:0n,seniorCoverageBps:BPS,coverageCapBps:9_999n})).toThrow());
  it("computes utilization without division-by-zero",()=>{expect(utilizationRay(0n,0n)).toBe(0n);expect(utilizationRay(20n,80n)).toBe(80n*RAY/100n)});
  it("follows the kink and maximum",()=>{const c={baseRateRay:pct(2),preKinkSlopeRay:pct(10),postKinkSlopeRay:pct(68),kinkRay:pct(80),maxRateRay:pct(80)};expect(borrowRateRay(0n,c)).toBe(pct(2));expect(borrowRateRay(pct(80),c)).toBe(pct(12));expect(borrowRateRay(RAY,c)).toBe(pct(80))});
  it("rounds debt toward solvency",()=>{const shares=debtSharesForPrincipal(1_000_001n,RAY);const index=accrueIndex(RAY,pct(10),YEAR_SECONDS/2n);expect(debtFromShares(shares,index)).toBeGreaterThanOrEqual(1_050_001n)});
  it("includes the full maximum-rate interval and fixed fees",()=>expect(worstCaseDebt(1_000_000n,pct(80),YEAR_SECONDS/2n,10_000n)).toBe(1_410_000n));
  it.each([0n,1_000n,5_000n,10_000n,13_000n,20_000n,50_000n,100_000n])("models the required %s bps price stress",multiple=>{const result=settlementScenario(1_000_000_000n,1_500_000_000n,multiple);expect(result.juniorSpent).toBeLessThanOrEqual(500_000_000n);expect(result.tokensReturnedBps).toBeLessThanOrEqual(BPS);if(multiple<=15_000n)expect(result.fullRedemption).toBe(true);else expect(result.topUpForFull).toBeGreaterThan(0n)});
});
