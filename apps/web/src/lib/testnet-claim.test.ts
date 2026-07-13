import { describe, expect, it } from "vitest";
import {
  claimAmount,
  validateCreatorMetadata,
  validateIndexedCreatorCoin,
} from "./testnet-claim";

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

  it("preserves the exact Base balance without a mint cap", () => {
    const thirtyMillionTokens = 30_000_000n * 10n ** 18n;
    expect(claimAmount(thirtyMillionTokens)).toBe(thirtyMillionTokens);
    expect(claimAmount(42n)).toBe(42n);
  });

  it("accepts indexed legacy Creator Coins without the latest coinType interface", () => {
    expect(() =>
      validateIndexedCreatorCoin(
        {
          address: "0x41859a1048fb4f8d668861b1249504bf52e6d3bd",
          coinType: "CREATOR",
          platformBlocked: false,
        },
        "0x41859a1048fb4f8d668861b1249504bf52e6d3bd",
      ),
    ).not.toThrow();
  });

  it("rejects non-creator, blocked, and mismatched indexed coins", () => {
    const source = "0x41859a1048fb4f8d668861b1249504bf52e6d3bd";
    expect(() => validateIndexedCreatorCoin(undefined, source)).toThrow("NOT_A_CREATOR_COIN");
    expect(() =>
      validateIndexedCreatorCoin(
        { address: source, coinType: "CONTENT", platformBlocked: false },
        source,
      ),
    ).toThrow("NOT_A_CREATOR_COIN");
    expect(() =>
      validateIndexedCreatorCoin(
        { address: source, coinType: "CREATOR", platformBlocked: true },
        source,
      ),
    ).toThrow("NOT_A_CREATOR_COIN");
    expect(() =>
      validateIndexedCreatorCoin(
        {
          address: "0xf774d7Fb286265B4359773c557E9E5DD4910474d",
          coinType: "CREATOR",
          platformBlocked: false,
        },
        source,
      ),
    ).toThrow("NOT_A_CREATOR_COIN");
  });
});
