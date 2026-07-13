import { describe, expect, it } from "vitest";
import { claimAmount, MAX_CLAIM_TOKENS, validateCreatorMetadata } from "./testnet-claim";

describe("testnet creator-token claims", () => {
  it("preserves valid source metadata exactly", () => {
    expect(() => validateCreatorMetadata("Alice Coin", "ALICE", 18)).not.toThrow();
  });

  it("rejects metadata the mirror contract cannot preserve", () => {
    expect(() => validateCreatorMetadata("", "ALICE", 18)).toThrow("INVALID_TOKEN_NAME");
    expect(() => validateCreatorMetadata("Alice", "A".repeat(25), 18)).toThrow("INVALID_TOKEN_SYMBOL");
    expect(() => validateCreatorMetadata("🎵".repeat(25), "MUSE", 18)).toThrow("INVALID_TOKEN_NAME");
    expect(() => validateCreatorMetadata("Alice", "ALICE", 19)).toThrow("INVALID_TOKEN_DECIMALS");
  });

  it("caps unusually large balances at one million whole tokens", () => {
    const maximum = MAX_CLAIM_TOKENS * 10n ** 18n;
    expect(claimAmount(maximum + 1n, 18)).toEqual({ amount: maximum, capped: true });
    expect(claimAmount(42n, 18)).toEqual({ amount: 42n, capped: false });
  });
});
