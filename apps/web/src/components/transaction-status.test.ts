import { describe, expect, it } from "vitest";
import { friendlyError } from "./transaction-status";

describe("friendlyError", () => {
  it("recognizes a rejected wallet request", () => {
    expect(friendlyError(new Error("User rejected the request"))).toContain("rejected");
  });

  it("recognizes insufficient network gas", () => {
    expect(friendlyError(new Error("insufficient funds for gas * price + value"))).toContain("enough ETH");
  });

  it("recognizes an on-chain revert", () => {
    expect(friendlyError(new Error("Transaction reverted on chain"))).toContain("reverted");
  });

  it("does not expose an unknown provider error", () => {
    const secretProviderMessage = "upstream rpc token abc123 failed";
    expect(friendlyError(new Error(secretProviderMessage))).not.toContain(secretProviderMessage);
  });
});
